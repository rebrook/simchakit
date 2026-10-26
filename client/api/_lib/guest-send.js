// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5 — api/_lib/guest-send.js (action "send" of api/guest.js)
// Vercel serverless function.
// POST { eventId, kind, subject, bodyTemplate, householdIds[], dry_run? }
// with an Authorization: Bearer <supabase access token> header.
// Sends a templated email to a list of households (guests) through Brevo.
//
// Identity comes ONLY from the Authorization header's JWT, validated against
// Supabase Auth, same as api/accept-invite.js. Nothing in the body identifies
// the caller. Households, event details and gifts are resolved server-side from
// the database; the client only supplies ids.
//
// Flow:
//   0. Validate the JWT (401 UNAUTHORIZED)
//   1. Load the event; caller must be owner or an accepted editor (403 NOT_AUTHORIZED)
//   2. Validate the body (400 INVALID_REQUEST); real sends on archived events 409
//   3. Resolve households; skip missing / no email / invalid email / opted out
//   4. Per-event rate limit from message_log (429 RATE_LIMITED); real sends only
//   5. Render previews; dry_run returns them and stops (no writes, no Brevo)
//   6. Write message_log + message_recipients (queued), send each through Brevo,
//      update each row to sent/failed. One failure never fails the batch.
//
// Merge fields: {{household_name}} {{event_name}} {{event_date}} {{venue}}
//   {{host_names}} {{rsvp_link}} (empty until V5-R1) {{gift_description}}
//   Every merged value and the template text are HTML-escaped.
//
// Env: BREVO_API_KEY, GUEST_MAIL_FROM (verified Brevo sender address),
//      GUEST_UNSUBSCRIBE_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Paywall: recipient counts are recorded in message_log only; not enforced.
// ─────────────────────────────────────────────────────────────────────────────

import { sendBrevoEmail } from "./brevo.js";
import { buildUnsubscribeUrl } from "./guest-unsub.js";

const KINDS = ["save_the_date", "invitation", "rsvp_reminder", "thank_you", "custom"];
const MERGE_FIELDS = [
  "household_name", "event_name", "event_date", "venue",
  "host_names", "rsvp_link", "gift_description",
];

const MAX_RECIPIENTS      = 500;
const MAX_SUBJECT_LENGTH  = 200;
const MAX_BODY_LENGTH     = 10000;
const MAX_FOOTER_LENGTH   = 1000;
const SENDS_PER_MINUTE    = 5;
const RECIPIENTS_PER_DAY  = 2000;
const SEND_CONCURRENCY    = 10;

const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Replaces merge tokens. `format` escapes each literal piece and each value.
function render(template, values, escape) {
  let out = "";
  let last = 0;
  for (const m of template.matchAll(TOKEN_RE)) {
    out += escape(template.slice(last, m.index));
    out += escape(values[m[1].toLowerCase()] ?? "");
    last = m.index + m[0].length;
  }
  return out + escape(template.slice(last));
}

const plain = s => s;
const oneLine = s => String(s).replace(/[\r\n]+/g, " ").trim();

function htmlBody(escapedText, footerHtml, unsubscribeUrl) {
  const paragraphs = escapedText.split(/\n{2,}/).map(p => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const footer = footerHtml ? `<p style="margin:16px 0 0;color:#666;font-size:13px">${footerHtml.replace(/\n/g, "<br>")}</p>` : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:600px">${paragraphs}${footer}` +
    `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 12px">` +
    `<p style="margin:0;color:#666;font-size:12px">Don't want these emails? <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>.</p></div>`;
}

function formatEventDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function mainTimelineEntry(adminConfig) {
  const timeline = Array.isArray(adminConfig?.timeline) ? adminConfig.timeline : [];
  return timeline.find(t => t?.isMainEvent) ||
    [...timeline].filter(t => t?.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null;
}

// Gift items for a household, same shape rules as utils/gifts.js
// (getGiftGivers / getGiftItems), including legacy single-gift rows.
function giftDescriptionFor(householdId, giftRows) {
  const parts = [];
  for (const row of giftRows) {
    const g = row?.data;
    if (!g) continue;
    const givers = Array.isArray(g.givers) && g.givers.length > 0 ? g.givers : [{ householdId: g.householdId }];
    if (!givers.some(gv => gv?.householdId === householdId)) continue;
    const items = Array.isArray(g.items) && g.items.length > 0
      ? g.items
      : [{ giftType: g.giftType, description: g.description }];
    for (const it of items) {
      const text = String(it?.description || it?.giftType || "").trim();
      if (text) parts.push(text);
    }
  }
  return parts.join(", ");
}

async function inChunks(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const dryRun = body.dry_run === true;

  // ── Supabase client (service role) ──────────────────────────────────────────
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Step 0: Authenticate the caller from the Authorization header ───────────
  const authHeader  = req.headers.authorization || req.headers.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearerToken) return res.status(401).json({ error: "UNAUTHORIZED" });

  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });
  const userId = authData.user.id;

  // ── Step 1: Caller must be owner or accepted editor of body.eventId ─────────
  const { eventId } = body;
  if (typeof eventId !== "string" || !UUID_RE.test(eventId)) {
    return res.status(400).json({ error: "INVALID_REQUEST", message: "eventId must be a valid event id." });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, owner_id, archived, admin_config, message_settings")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error("[SimchaKit] send-guest-message: event lookup failed:", eventError.message);
    return res.status(500).json({ error: "Failed to load event." });
  }
  if (!event) return res.status(404).json({ error: "Event not found." });

  if (event.owner_id !== userId) {
    const { data: collab } = await supabase
      .from("event_collaborators")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (collab?.role !== "editor") return res.status(403).json({ error: "NOT_AUTHORIZED" });
  }

  // ── Step 2: Validate the body ───────────────────────────────────────────────
  const { kind, subject, bodyTemplate, householdIds } = body;
  const problems = [];
  if (!KINDS.includes(kind)) problems.push(`kind must be one of ${KINDS.join(", ")}.`);
  if (typeof subject !== "string" || !subject.trim() || subject.length > MAX_SUBJECT_LENGTH) {
    problems.push(`subject is required (max ${MAX_SUBJECT_LENGTH} characters).`);
  }
  if (typeof bodyTemplate !== "string" || !bodyTemplate.trim() || bodyTemplate.length > MAX_BODY_LENGTH) {
    problems.push(`bodyTemplate is required (max ${MAX_BODY_LENGTH} characters).`);
  }
  if (!Array.isArray(householdIds) || householdIds.length === 0 || householdIds.some(id => typeof id !== "string" || !id || id.length > 100)) {
    problems.push("householdIds must be a non-empty array of household ids.");
  } else if (householdIds.length > MAX_RECIPIENTS) {
    problems.push(`At most ${MAX_RECIPIENTS} households per send.`);
  }
  if (body.dry_run !== undefined && typeof body.dry_run !== "boolean") problems.push("dry_run must be a boolean.");
  if (problems.length === 0) {
    const unknown = [...new Set([...(subject + " " + bodyTemplate).matchAll(TOKEN_RE)]
      .map(m => m[1].toLowerCase()).filter(f => !MERGE_FIELDS.includes(f)))];
    if (unknown.length) problems.push(`Unknown merge fields: ${unknown.map(f => `{{${f}}}`).join(", ")}.`);
  }
  if (problems.length) return res.status(400).json({ error: "INVALID_REQUEST", message: problems.join(" "), problems });

  if (event.archived && !dryRun) {
    return res.status(409).json({ error: "EVENT_ARCHIVED", message: "This event is archived and read-only." });
  }

  const ids = [...new Set(householdIds)];

  // ── Step 3: Resolve households from the database ────────────────────────────
  const { data: hhRows, error: hhError } = await supabase
    .from("households")
    .select("id, data, email_opt_out")
    .eq("event_id", eventId)
    .in("id", ids);
  if (hhError) {
    console.error("[SimchaKit] send-guest-message: household lookup failed:", hhError.message);
    return res.status(500).json({ error: "Failed to load households." });
  }
  const byId = new Map((hhRows || []).map(r => [r.id, r]));

  const skipped = [];
  const targets = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { skipped.push({ householdId: id, reason: "not_found" }); continue; }
    const name  = String(row.data?.formalName || row.data?.name || "").trim();
    const email = String(row.data?.email || "").trim().toLowerCase();
    if (row.email_opt_out)   { skipped.push({ householdId: id, name, reason: "opted_out" }); continue; }
    if (!email)              { skipped.push({ householdId: id, name, reason: "no_email" });  continue; }
    if (!EMAIL_RE.test(email)) { skipped.push({ householdId: id, name, reason: "invalid_email" }); continue; }
    targets.push({ id, name, email });
  }

  // ── Step 4: Per-event rate limit (real sends only) ──────────────────────────
  if (!dryRun && targets.length > 0) {
    const now = Date.now();
    const { data: recent, error: recentError } = await supabase
      .from("message_log")
      .select("sent_at, recipient_count")
      .eq("event_id", eventId)
      .gte("sent_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
    if (recentError) {
      console.error("[SimchaKit] send-guest-message: rate limit lookup failed:", recentError.message);
      return res.status(500).json({ error: "Failed to check send limits." });
    }

    const minuteAgo = now - 60 * 1000;
    const lastMinute = (recent || []).filter(r => new Date(r.sent_at).getTime() > minuteAgo);
    if (lastMinute.length >= SENDS_PER_MINUTE) {
      const oldest = Math.min(...lastMinute.map(r => new Date(r.sent_at).getTime()));
      const retryAfter = Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "RATE_LIMITED", scope: "per_minute", limit: SENDS_PER_MINUTE, retryAfterSeconds: retryAfter,
        message: `You can send up to ${SENDS_PER_MINUTE} messages per minute for an event. Try again in ${retryAfter} seconds.`,
      });
    }

    const sentToday = (recent || []).reduce((n, r) => n + (r.recipient_count || 0), 0);
    if (sentToday + targets.length > RECIPIENTS_PER_DAY) {
      const remaining = Math.max(0, RECIPIENTS_PER_DAY - sentToday);
      const oldest = Math.min(...(recent || []).map(r => new Date(r.sent_at).getTime()));
      const retryAfter = Math.max(60, Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "RATE_LIMITED", scope: "per_day", limit: RECIPIENTS_PER_DAY, remaining, retryAfterSeconds: retryAfter,
        message: `This event can send to ${RECIPIENTS_PER_DAY.toLocaleString("en-US")} recipients per day. You have ${remaining} left in the last 24 hours and tried to send to ${targets.length}.`,
      });
    }
  }

  // ── Step 5: Resolve event context and render ────────────────────────────────
  const settings = event.message_settings && typeof event.message_settings === "object" ? event.message_settings : {};

  const { data: ownerProfile } = await supabase
    .from("user_profiles")
    .select("email, display_name")
    .eq("id", event.owner_id)
    .maybeSingle();

  const senderName = oneLine(settings.senderName || event.name || ownerProfile?.display_name || "SimchaKit").slice(0, 100);
  const replyToRaw = String(settings.replyTo || ownerProfile?.email || "").trim();
  const replyTo    = EMAIL_RE.test(replyToRaw) ? replyToRaw : null;
  const footerText = String(settings.footerText || "").slice(0, MAX_FOOTER_LENGTH);

  const mainEntry = mainTimelineEntry(event.admin_config);
  const hostNames = String(event.admin_config?.hostNames || ownerProfile?.display_name || "").trim();
  const eventValues = {
    event_name: event.name || "",
    event_date: formatEventDate(mainEntry?.startDate),
    venue:      mainEntry?.venue || "",
    host_names: hostNames,
    rsvp_link:  "",          // populated once V5-R1 (RSVP links) lands
  };

  let giftRows = [];
  if (/\{\{\s*gift_description\s*\}\}/i.test(bodyTemplate + subject) && targets.length > 0) {
    const { data, error } = await supabase.from("gifts").select("data").eq("event_id", eventId);
    if (error) {
      console.error("[SimchaKit] send-guest-message: gift lookup failed:", error.message);
      return res.status(500).json({ error: "Failed to load gifts." });
    }
    giftRows = data || [];
  }

  const secret = process.env.GUEST_UNSUBSCRIBE_SECRET;
  if (!dryRun && targets.length > 0 && (!secret || !process.env.GUEST_MAIL_FROM || !process.env.BREVO_API_KEY)) {
    console.error("[SimchaKit] send-guest-message: BREVO_API_KEY, GUEST_MAIL_FROM or GUEST_UNSUBSCRIBE_SECRET is not set.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const messages = targets.map(t => {
    const values = {
      ...eventValues,
      household_name:   t.name,
      gift_description: giftDescriptionFor(t.id, giftRows),
    };
    const unsubscribeUrl = secret
      ? buildUnsubscribeUrl(secret, eventId, t.id)
      : `https://app.simcha-kit.com/api/guest?action=unsubscribe&preview=1`;
    const renderedSubject = oneLine(render(subject, values, plain));
    const text = render(bodyTemplate, values, plain);
    const html = htmlBody(
      render(bodyTemplate, values, escapeHtml).replace(/\r\n?/g, "\n"),
      footerText ? escapeHtml(footerText) : "",
      unsubscribeUrl
    );
    const textFull = `${text}${footerText ? `\n\n${footerText}` : ""}\n\n--\nUnsubscribe: ${unsubscribeUrl}`;
    return { ...t, subject: renderedSubject, html, text: textFull, unsubscribeUrl };
  });

  // ── dry_run: everything except writes and the Brevo call ────────────────────
  if (dryRun) {
    return res.status(200).json({
      dryRun: true,
      sender: { name: senderName, replyTo },
      recipientCount: messages.length,
      previews: messages.map(m => ({ householdId: m.id, name: m.name, email: m.email, subject: m.subject, html: m.html, text: m.text })),
      skipped,
    });
  }

  if (messages.length === 0) {
    return res.status(200).json({ dryRun: false, messageId: null, sent: 0, failed: 0, results: [], skipped });
  }

  // ── Step 6: Log, send, record ───────────────────────────────────────────────
  const { data: logRow, error: logError } = await supabase
    .from("message_log")
    .insert({
      event_id:        eventId,
      kind,
      subject:         subject.trim(),
      body_snapshot:   bodyTemplate,
      sent_by:         userId,
      recipient_count: messages.length,
    })
    .select("id")
    .single();
  if (logError || !logRow) {
    console.error("[SimchaKit] send-guest-message: message_log insert failed:", logError?.message);
    return res.status(500).json({ error: "Failed to record message." });
  }
  const messageId = logRow.id;

  const { error: recipientsError } = await supabase
    .from("message_recipients")
    .insert(messages.map(m => ({ message_id: messageId, household_id: m.id, email: m.email, status: "queued" })));
  if (recipientsError) {
    console.error("[SimchaKit] send-guest-message: recipients insert failed:", recipientsError.message);
    await supabase.from("message_log").delete().eq("id", messageId);
    return res.status(500).json({ error: "Failed to record recipients." });
  }

  const results = [];
  await inChunks(messages, SEND_CONCURRENCY, async m => {
    const outcome = await sendBrevoEmail(process.env.BREVO_API_KEY, {
      sender:      { name: senderName, email: process.env.GUEST_MAIL_FROM },
      to:          [{ email: m.email, name: m.name || undefined }],
      ...(replyTo && { replyTo: { email: replyTo } }),
      subject:     m.subject,
      htmlContent: m.html,
      textContent: m.text,
      headers: {
        "List-Unsubscribe":      `<${m.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: ["guest-message", kind],
    });
    if (!outcome.ok) console.error(`[SimchaKit] send-guest-message: send failed for ${m.id}:`, outcome.error);

    const { error: updateError } = await supabase
      .from("message_recipients")
      .update({ status: outcome.ok ? "sent" : "failed", error: outcome.error, provider_id: outcome.providerId })
      .eq("message_id", messageId)
      .eq("household_id", m.id);
    if (updateError) console.error("[SimchaKit] send-guest-message: status update failed:", updateError.message);

    results.push({
      householdId: m.id,
      status: outcome.ok ? "sent" : "failed",
      ...(outcome.ok ? {} : { error: "Delivery failed." }),
    });
  });

  const sent = results.filter(r => r.status === "sent").length;
  return res.status(200).json({ dryRun: false, messageId, sent, failed: results.length - sent, results, skipped });
}
