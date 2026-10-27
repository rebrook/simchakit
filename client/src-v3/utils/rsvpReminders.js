// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.6.0 — utils/rsvpReminders.js
// Who still owes an RSVP, and when they were last reminded. Shared by the Overview
// "haven't replied" card, the Guests tab and the message composer, so all three always
// agree on the same households.
//
// A household "hasn't replied" when, for any sub-event it is invited to, its status is
// still Invited or Pending (the same status the guest list shows), AND it has no RSVP
// reply from its link waiting for review or already accepted. Households that replied
// through the link are left alone even if the host has not touched their status yet.
// ─────────────────────────────────────────────────────────────────────────────

import { isInvited, getSubEventStatus } from "@/utils/sections.js";
import { getPeopleForHousehold } from "@/utils/guests.js";
import { householdKey } from "@/utils/messageStatus.js";

export const REMINDER_COOLDOWN_DAYS = 3;
const AWAITING = ["Invited", "Pending"];

// repliedHouseholdRowIds: Set of households.id values with a pending or accepted RSVP reply.
export function unrepliedHouseholds(households, people, timeline, repliedHouseholdRowIds = new Set()) {
  const sections = Array.isArray(timeline) ? timeline.filter(t => t?.id) : [];
  return households.filter(hh => {
    if (repliedHouseholdRowIds.has(householdKey(hh))) return false;
    const members = getPeopleForHousehold(people, hh.id);
    const invited = sections.filter(s => isInvited(hh, s));
    if (invited.length === 0) return AWAITING.includes(hh.rsvpStatus);
    return invited.some(s => AWAITING.includes(getSubEventStatus(hh, members, s)));
  });
}

// Whole days from today to a YYYY-MM-DD date (negative once it has passed); null if unset.
export function daysUntil(dateStr, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(`${dateStr}T00:00:00`) - today) / 86400000);
}

// True when a "sent" status (from buildSentLookup) is within the cooldown.
export function remindedRecently(status, now = new Date(), days = REMINDER_COOLDOWN_DAYS) {
  if (!status || status.tone !== "sent" || !status.date) return false;
  const t = new Date(status.date).getTime();
  return !Number.isNaN(t) && now.getTime() - t < days * 86400000;
}
