// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.3.0 — api/_lib/rsvp-shared.js
// Shared by the guest RSVP endpoints (rsvp-get, rsvp-submit) and the host-side
// link action. Guests have no account: the private token in the link is the only
// credential, and everything a guest can see is built here from what THAT
// household may see. The token is a bearer secret, so nothing in this file logs it.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { PALETTES } from "../../src-v3/constants/theme.js";
import { deriveCustomPalette } from "../../src-v3/utils/color.js";
import { DEFAULT_MEALS } from "../../src-v3/constants/guest-constants.js";
import { generateRsvpToken } from "../../src-v3/utils/rsvpToken.js";

export const APP_ORIGIN = "https://app.simcha-kit.com";

export const DEFAULT_RSVP_SETTINGS = {
  allowPlusOnes: false,
  maxNewGuests: 2,
  autoApply: false,
  allowEditUntilDeadline: true,
};
export const MAX_NEW_GUESTS_LIMIT = 6;

const HEX_RE = /^#[0-9a-f]{6}$/i;

export async function getServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── HTTP hygiene ──────────────────────────────────────────────────────────────
// No CORS for other origins: the guest page is served by the app itself, so its
// calls are same-origin. Only the app origin is allowed if a browser asks.
export function applyHeaders(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Vary", "Origin");
  if (req.headers.origin === APP_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-rsvp-token");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

// The token comes in a header (or the POST body), never the URL: URLs end up in
// request logs. Returns "" when absent.
export function readToken(req) {
  const h = req.headers["x-rsvp-token"];
  const fromHeader = Array.isArray(h) ? h[0] : h;
  const fromBody = typeof req.body?.token === "string" ? req.body.token : "";
  return String(fromHeader || fromBody || "").trim();
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Best effort and per serverless instance: it blunts guessing and hammering without
// a database table, but is not a global counter. Keys are hashed so IPs and tokens
// are not held in memory in the clear. (Submissions also have a per-household
// limit in the database; see rsvp-submit.js.)
const hits = new Map();
export function rateLimited(scope, rawKey, max, windowMs) {
  const now = Date.now();
  const key = `${scope}:${createHash("sha256").update(String(rawKey)).digest("hex").slice(0, 24)}`;
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return false;
}

export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  return String((Array.isArray(xff) ? xff[0] : xff) || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

// ── Settings, deadline, theme ─────────────────────────────────────────────────
export function effectiveSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const max = Number.isInteger(s.maxNewGuests) ? Math.min(Math.max(s.maxNewGuests, 0), MAX_NEW_GUESTS_LIMIT) : DEFAULT_RSVP_SETTINGS.maxNewGuests;
  return {
    allowPlusOnes:          s.allowPlusOnes === true,
    maxNewGuests:           max,
    autoApply:              s.autoApply === true,
    allowEditUntilDeadline: s.allowEditUntilDeadline !== false,
  };
}

// Deadline is the existing Event Details date (admin_config.rsvpDeadline), inclusive:
// replies close once the deadline's calendar day (UTC) has passed.
export function deadlinePassed(deadline, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deadline || ""))) return false;
  const endOfDay = new Date(`${deadline}T23:59:59.999Z`);
  return !Number.isNaN(endOfDay.getTime()) && now > endOfDay;
}

export function resolveTheme(adminConfig) {
  const t = adminConfig?.theme && typeof adminConfig.theme === "object" ? adminConfig.theme : {};
  let colors;
  if (t.palette === "custom" && HEX_RE.test(String(t.customColor || ""))) {
    colors = deriveCustomPalette(t.customColor);
    return { palette: "custom", customColor: t.customColor, light: colors.light, dark: colors.dark };
  }
  const key = PALETTES[t.palette] ? t.palette : "rose";
  return { palette: key, customColor: "", light: PALETTES[key], dark: null };
}

const httpsOrEmpty = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");

// Same rule as the app's isInvited(): explicitly checked, or the sub-event invites everyone by default.
const isInvited = (household, section) =>
  (household.invitedSections || []).includes(section.id) || section.inviteAllByDefault !== false;

// Host-only fields on timeline entries (admin_config.timeline). Nothing a guest can reach may carry
// them: audience (family-only entries), arriveBy, and the room and address used for the host's
// schedule. buildView below picks fields by name, so these are never copied; stripHostOnly is the
// belt to that suspenders for any entry that is passed through whole.
export const HOST_ONLY_TIMELINE_FIELDS = ["audience", "arriveBy", "room", "address"];
export function stripHostOnly(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  HOST_ONLY_TIMELINE_FIELDS.forEach(k => { delete out[k]; });
  return out;
}

function mainEntry(timeline) {
  const list = Array.isArray(timeline) ? timeline : [];
  return list.find(t => t?.isMainEvent) ||
    [...list].filter(t => t?.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null;
}

// ── Loading by token ──────────────────────────────────────────────────────────
// Returns null for an unknown token, a household that no longer exists, or an
// event mismatch: callers answer all three with the same 404.
export async function loadByToken(supabase, token) {
  const { data: tokenRow } = await supabase
    .from("household_rsvp_tokens").select("household_id, event_id").eq("token", token).maybeSingle();
  if (!tokenRow) return null;

  const { data: hhRow } = await supabase
    .from("households").select("id, event_id, data").eq("id", tokenRow.household_id).maybeSingle();
  if (!hhRow || hhRow.event_id !== tokenRow.event_id) return null;

  const { data: event } = await supabase
    .from("events").select("id, name, archived, admin_config, rsvp_settings").eq("id", tokenRow.event_id).maybeSingle();
  if (!event) return null;

  const household = { ...(hhRow.data || {}), _rowId: hhRow.id };
  // People link to their household by the id stored inside the household's data.
  const { data: peopleRows } = await supabase
    .from("people").select("id, data").eq("event_id", event.id).eq("data->>householdId", household.id || hhRow.id);

  const { data: pending } = await supabase
    .from("rsvp_replies").select("id, submitted_at, payload")
    .eq("household_id", hhRow.id).eq("status", "pending").maybeSingle();

  const { data: anyReply } = await supabase
    .from("rsvp_replies").select("id").eq("household_id", hhRow.id).is("superseded_at", null).limit(1);

  return {
    event,
    household,
    people: (peopleRows || []).map(r => ({ ...(r.data || {}), _rowId: r.id })),
    pending: pending || null,
    hasReply: Array.isArray(anyReply) && anyReply.length > 0,
    settings: effectiveSettings(event.rsvp_settings),
  };
}

// null when open; otherwise { reason, message } for a friendly closed state.
export function closedState(ctx) {
  const { event, settings, hasReply } = ctx;
  if (event.archived) {
    return { reason: "archived", message: "This event has ended, so replies are closed. Please contact your host." };
  }
  if (deadlinePassed(event.admin_config?.rsvpDeadline)) {
    return { reason: "deadline", message: "The reply date has passed, so replies are now closed. Please contact your host if your plans have changed." };
  }
  if (!settings.allowEditUntilDeadline && hasReply) {
    return { reason: "already_submitted", message: "Thank you, your reply has been received. If you need to change it, please contact your host." };
  }
  return null;
}

// What this household is allowed to see: its own people, the sub-events it is
// invited to, and the event basics. Nothing about other households or the host's
// admin data. `ids` are database row ids (people.id), the ones POST must echo back.
export function buildView(ctx) {
  const { event, household, people, pending, settings } = ctx;
  const cfg = event.admin_config || {};
  const main = mainEntry(cfg.timeline);
  const theme = resolveTheme(cfg);
  const closed = closedState(ctx);

  const eventView = {
    name:     event.name || "",
    date:     main?.startDate || "",
    venue:    main?.venue || "",
    logoUrl:  httpsOrEmpty(cfg.logoUrl),
    theme,
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(cfg.rsvpDeadline || "")) ? cfg.rsvpDeadline : "",
  };
  const sections = (Array.isArray(cfg.timeline) ? cfg.timeline : [])
    .filter(t => t?.id && isInvited(household, t))
    .map(stripHostOnly)
    .sort((a, b) => `${a.startDate || ""}${a.startTime || ""}`.localeCompare(`${b.startDate || ""}${b.startTime || ""}`))
    .map(t => ({
      id: t.id, title: t.title || "", icon: t.icon || "",
      startDate: t.startDate || "", startTime: t.startTime || "", endTime: t.endTime || "",
      venue: t.venue || "",
      servesMeal: t.servesMeal === true,   // the page asks for meal choices only where a meal is served
    }));

  const pendingAnswers = new Map((pending?.payload?.answers || []).map(a => [`${a.personId}|${a.sectionId}`, a.status]));
  const pendingDetails = new Map((pending?.payload?.details || []).map(d => [d.personId, d]));
  const fromStored = (v) => (v === "Yes" ? "yes" : v === "No" ? "no" : null);

  const body = {
    household: {
      formalName: household.formalName || "",
      address: {
        address1: household.address1 || "", address2: household.address2 || "", city: household.city || "",
        stateProvince: household.stateProvince || "", postalCode: household.postalCode || "", country: household.country || "",
      },
    },
    people: people.map(p => {
      const d = pendingDetails.get(p._rowId);
      return {
        id: p._rowId,
        firstName: p.firstName || (p.name || "").split(" ")[0] || "",
        isChild: !!p.isChild,
        mealChoice: d?.mealChoice ?? p.mealChoice ?? "",
        dietary:    d?.dietary    ?? p.dietary    ?? "",
        kosher:     d?.kosher     ?? !!p.kosher,
        answers: Object.fromEntries(sections.map(s => [
          s.id, pendingAnswers.get(`${p._rowId}|${s.id}`) ?? fromStored(p.sectionRsvp?.[s.id]),
        ])),
      };
    }),
    sections,
    mealOptions: Array.isArray(cfg.mealChoices) && cfg.mealChoices.length ? cfg.mealChoices : DEFAULT_MEALS,
    allowPlusOnes: settings.allowPlusOnes,
    maxNewGuests: settings.allowPlusOnes ? settings.maxNewGuests : 0,
    submittedAt: pending?.submitted_at || null,
    note: pending?.payload?.note || "",
  };

  // Closed by deadline or because the household already replied: the guest can still see
  // their last answers (read-only on the page). An archived event shows the message and
  // event basics only.
  if (closed) {
    return {
      closed: true, reason: closed.reason, message: closed.message, event: eventView,
      ...(closed.reason === "archived" ? {} : body),
    };
  }
  return { closed: false, event: eventView, ...body };
}

// ── Tokens (host side and {{rsvp_link}}) ──────────────────────────────────────
// Returns Map(householdRowId -> token), creating missing tokens (lazily, 128 random
// bits). Safe under concurrent calls: the primary key makes a duplicate insert a no-op
// and the final read returns whichever token won.
export async function ensureTokens(supabase, eventId, householdIds) {
  const ids = [...new Set(householdIds)];
  const result = new Map();
  if (ids.length === 0) return result;

  const read = async () => {
    const { data, error } = await supabase
      .from("household_rsvp_tokens").select("household_id, token").eq("event_id", eventId).in("household_id", ids);
    if (error) throw new Error(error.message);
    (data || []).forEach(r => result.set(r.household_id, r.token));
  };
  await read();
  const missing = ids.filter(id => !result.has(id));
  if (missing.length) {
    const { error } = await supabase.from("household_rsvp_tokens")
      .upsert(missing.map(id => ({ household_id: id, event_id: eventId, token: generateRsvpToken() })),
        { onConflict: "household_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    await read();
  }
  return result;
}
