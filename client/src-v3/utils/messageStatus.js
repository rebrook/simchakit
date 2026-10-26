// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — utils/messageStatus.js
// Per-household "was this sent?" status, derived from the message log.
//
// The log (message_log + message_recipients) is the only source of truth. The
// pre-V5 flags (saveTheDateSent, inviteSent, thankYouSent) are read as a
// fallback so existing events keep their status, shown as "Sent (manual)"; they
// are never written by sends or marks. Only the explicit Clear action on a
// "Sent (manual)" chip changes them.
//
// For one household and kind, the latest log entry wins (newest sent_at, then
// newest log row). A failed latest entry shows Failed even if an earlier send
// succeeded, so a failed retry stays visible.
// ─────────────────────────────────────────────────────────────────────────────

import { channelLabel } from "@/utils/messageTemplates.js";

// The message tables (and api/guest) identify a household by its database row id,
// which useEventData exposes as _rowId. The `id` inside the household's data is a
// separate app-generated id and is NOT what the server matches.
const householdKey = (household) => household?._rowId || household?.id;

// Legacy flag per kind (null: that kind never had a checkbox).
const LEGACY_FLAG = {
  save_the_date: "saveTheDateSent",
  invitation:    "inviteSent",
  thank_you:     "thankYouSent",
  rsvp_reminder: null,
  custom:        null,
};

// Status tones: none | sent | failed. "state" is the specific label key.
// Shapes (not color) carry meaning too: hollow circle, filled circle, triangle.
function describeEntry(entry) {
  if (entry.status === "failed" || entry.status === "bounced") {
    return { state: "failed", tone: "failed", label: entry.status === "bounced" ? "Bounced" : "Failed", date: entry.sentAt };
  }
  if (entry.status === "queued") {
    return { state: "sending", tone: "none", label: "Sending", date: entry.sentAt };
  }
  const channel = entry.channel || "email";
  const state = channel === "paper" ? "mail" : channel === "external" ? "elsewhere" : "email";
  const label = channel === "paper" ? "Sent by mail" : channel === "external" ? "Sent elsewhere" : "Sent by email";
  return { state, tone: "sent", label, date: entry.sentAt };
}

// recipients: rows { messageId, householdId, kind, channel, status, sentAt, loggedAt }.
// Returns a lookup (household, kind) => { state, tone, label, date }.
function buildSentLookup(recipients) {
  const latest = new Map();   // `${householdId}|${kind}` -> entry
  const time = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; };
  const newer = (a, b) =>
    time(a.sentAt) !== time(b.sentAt) ? time(a.sentAt) > time(b.sentAt) : time(a.loggedAt) > time(b.loggedAt);
  for (const r of recipients || []) {
    const key = `${r.householdId}|${r.kind}`;
    const cur = latest.get(key);
    if (!cur || newer(r, cur)) latest.set(key, r);
  }
  return (household, kind) => {
    const entry = latest.get(`${householdKey(household)}|${kind}`);
    if (entry) return describeEntry(entry);
    const flag = LEGACY_FLAG[kind];
    if (flag && household?.[flag]) return { state: "manual", tone: "sent", label: "Sent (manual)", date: null, flag };
    return { state: "none", tone: "none", label: "Not sent", date: null };
  };
}

// Any channel counts as sent, including manual marks and the legacy flag.
const isSent = (status) => status?.tone === "sent";

// "Mar 3" style, in the viewer's locale, for a date or ISO timestamp.
function shortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "Sent by email (Mar 3, 2026)" for chips and tooltips.
function statusText(status) {
  const d = shortDate(status?.date);
  return d && status.tone !== "none" ? `${status.label} (${d})` : status?.label || "";
}

export { householdKey, LEGACY_FLAG, describeEntry, buildSentLookup, isSent, shortDate, statusText, channelLabel };
