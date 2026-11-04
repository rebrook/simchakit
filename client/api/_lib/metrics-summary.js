// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/_lib/metrics-summary.js
// GET /api/admin?action=metrics-summary with Authorization: Bearer <METRICS_READ_TOKEN>
// Read-only business and health numbers for the planning agents. COUNTS AND TALLIES ONLY: no names,
// emails, guest details or event contents are returned. Crash messages are clipped and have anything
// email-shaped removed. The token is a separate secret from every other credential, so it can be
// handed to a scheduled agent and revoked on its own by changing METRICS_READ_TOKEN in Vercel.
// Stripe test-mode purchases (session ids starting cs_test_) are left out of every figure.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

const DAY = 86_400_000;

const sha = (s) => createHash("sha256").update(String(s)).digest();

function tokenOk(req) {
  const expected = process.env.METRICS_READ_TOKEN;
  if (!expected) return false;
  const header = req.headers.authorization || "";
  const given  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return timingSafeEqual(sha(given), sha(expected));
}

// Stripe test-mode sessions (cs_test_...) are the owner's own tests: keep them out of every figure.
const isTestPurchase = (p) => String(p.stripe_session_id || "").startsWith("cs_test_");

const tally = (rows, pick) => {
  const out = {};
  rows.forEach((r) => {
    const k = pick(r);
    if (k) out[k] = (out[k] || 0) + 1;
  });
  return out;
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.METRICS_READ_TOKEN) return res.status(503).json({ error: "Metrics are not configured." });
  if (!tokenOk(req)) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const now   = Date.now();
  const iso   = (days) => new Date(now - days * DAY).toISOString();
  const errors = [];

  const count = async (table, build = (q) => q) => {
    const { count: n, error } = await build(supabase.from(table).select("id", { count: "exact", head: true }));
    if (error) { errors.push(`${table}: count failed`); return null; }
    return n;
  };
  const rows = async (table, columns, build = (q) => q) => {
    const { data, error } = await build(supabase.from(table).select(columns).limit(5000));
    if (error) { errors.push(`${table}: read failed`); return []; }
    return data || [];
  };

  const [
    usersTotal, users7, users30, usersWithEvent,
    eventsTotal, events7, events30, eventsArchived,
    households, people,
    allPurchases, profiles, replies, messages30, clientErrors,
    noEventUsers, collaborators,
  ] = await Promise.all([
    count("user_profiles"),
    count("user_profiles", (q) => q.gte("created_at", iso(7))),
    count("user_profiles", (q) => q.gte("created_at", iso(30))),
    count("user_profiles", (q) => q.gt("event_count", 0)),
    count("events"),
    count("events", (q) => q.gte("created_at", iso(7))),
    count("events", (q) => q.gte("created_at", iso(30))),
    count("events", (q) => q.eq("archived", true)),
    count("households"),
    count("people"),
    rows("purchases", "owner_id, status, amount_cents, coupon_code, event_id, created_at, stripe_session_id"),
    rows("user_profiles", "heard_from, signup_source, created_at", (q) => q.gte("created_at", iso(90))),
    rows("rsvp_replies", "status, submitted_at", (q) => q.gte("submitted_at", iso(30))),
    count("message_log", (q) => q.gte("sent_at", iso(30))),
    rows("client_errors", "created_at, data", (q) => q.gte("created_at", iso(30))),
    rows("user_profiles", "id", (q) => q.eq("event_count", 0)),
    rows("event_collaborators", "user_id"),
  ]);

  const purchases = allPurchases.filter((p) => !isTestPurchase(p));
  const pendingRows = purchases.filter((p) => p.status === "pending");
  const collaboratorIds = new Set(collaborators.map((c) => c.user_id));

  const completed = purchases.filter((p) => p.status === "completed");
  const paid      = completed.filter((p) => (p.amount_cents || 0) > 0);
  const since     = (list, days) => list.filter((p) => new Date(p.created_at).getTime() >= now - days * DAY);

  const errors7  = clientErrors.filter((e) => new Date(e.created_at).getTime() >= now - 7 * DAY);
  const messages = {};
  clientErrors.forEach((e) => {
    const m = String(e.data?.message || "").replace(/[^\s]+@[^\s]+/g, "[email]").replace(/\s+/g, " ").slice(0, 120);
    if (m) messages[m] = (messages[m] || 0) + 1;
  });

  return res.status(200).json({
    asOf: new Date(now).toISOString(),
    users:  {
      total: usersTotal, last7Days: users7, last30Days: users30, withAtLeastOneEvent: usersWithEvent,
      // Who the people with no event are: co-planners who joined someone else's event versus everyone else.
      withoutEvent: {
        total:                  noEventUsers.length,
        joinedAsCollaborator:   noEventUsers.filter((u) => collaboratorIds.has(u.id)).length,
        neverCollaborated:      noEventUsers.filter((u) => !collaboratorIds.has(u.id)).length,
      },
    },
    events: { total: eventsTotal, last7Days: events7, last30Days: events30, archived: eventsArchived },
    usage:  { households, people, guestEmailBatchesLast30Days: messages30 },
    purchases: {
      completed:        completed.length,
      paid:             paid.length,
      freeOrCouponZero: completed.length - paid.length,
      pending:          pendingRows.length,
      pendingUnder24Hours: pendingRows.filter((p) => new Date(p.created_at).getTime() >= now - DAY).length,
      pendingOlderThan30Days: pendingRows.filter((p) => new Date(p.created_at).getTime() < now - 30 * DAY).length,
      testPurchasesExcluded: allPurchases.length - purchases.length,
      refunded:         purchases.filter((p) => p.status === "refunded").length,
      completedWithoutEvent: completed.filter((p) => !p.event_id).length,
      distinctBuyers:   new Set(completed.map((p) => p.owner_id)).size,
      revenueCentsTotal:   paid.reduce((s, p) => s + (p.amount_cents || 0), 0),
      revenueCentsLast30Days: since(paid, 30).reduce((s, p) => s + (p.amount_cents || 0), 0),
      couponPurchasesLast30Days: since(completed, 30).filter((p) => p.coupon_code).length,
    },
    signupsLast90Days: {
      total:          profiles.length,
      bySource:       tally(profiles, (r) => r.signup_source?.source || (r.signup_source?.referrer ? `referrer:${r.signup_source.referrer}` : null)),
      byMedium:       tally(profiles, (r) => r.signup_source?.medium),
      byCampaign:     tally(profiles, (r) => r.signup_source?.campaign),
      heardFrom:      tally(profiles, (r) => r.heard_from),
      withNoSourceCaptured: profiles.filter((r) => !r.signup_source && !r.heard_from).length,
    },
    guestRsvpRepliesLast30Days: { total: replies.length, byStatus: tally(replies, (r) => r.status) },
    crashes: {
      last7Days:  errors7.length,
      last30Days: clientErrors.length,
      bySourceLast30Days: tally(clientErrors, (e) => e.data?.source),
      topMessagesLast30Days: Object.entries(messages).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([message, n]) => ({ message, count: n })),
    },
    dataGaps: errors,
  });
}
