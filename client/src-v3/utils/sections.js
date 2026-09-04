// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — utils/sections.js
// Shared sub-event invite/attendance helpers, extracted from GuestsTab.jsx
// (V4.27.5). GuestsTab had the correct logic all along; OverviewTab.jsx,
// DayOfOverlay.jsx, and utils/exports.js each independently re-derived a
// simplified (and incorrect) version of the same check, silently undercounting
// invited guests for any "invite all by default" sub-event. Every consumer now
// imports from here instead, so there is one true definition of "who's invited"
// and "who's confirmed" for a sub-event.
// ─────────────────────────────────────────────────────────────────────────────

// Each timeline entry (sub-event) carries its own inviteAllByDefault flag (true
// unless explicitly set to false in Admin Mode). A household's invitedSections
// is a pure positive list (checked ids only) -- there's no way to explicitly
// exclude a household from a default-all sub-event, only to opt one into an
// opt-in-only sub-event. That's a known, accepted limitation, not a bug.
export function isInvited(hh, section) {
  const explicitlyChecked = (hh.invitedSections || []).includes(section.id);
  if (explicitlyChecked) return true;
  return section.inviteAllByDefault !== false; // undefined/absent = true (backward compat)
}

// Returns null when the household is not invited to this section -- callers
// treat null as "don't render a chip / row / filter match". An explicit
// hh.subEventRsvp[section.id] always wins; otherwise status is RSVP Yes if
// anyone in the household is marked attending, or the household's own real
// rsvpStatus (Invited, Pending, RSVP No, whatever it actually is) if not --
// never a hardcoded default that could contradict what's actually been recorded.
export function getSubEventStatus(hh, hhMembers, section) {
  if (!isInvited(hh, section)) return null;
  const explicit = hh.subEventRsvp?.[section.id];
  if (explicit) return explicit;
  const anyoneAttending = (hhMembers || []).some(p => (p.attendingSections || []).includes(section.id));
  if (anyoneAttending) return "RSVP Yes";
  return hh.rsvpStatus || "Invited";
}

// People belonging to households invited to this section, per isInvited() above.
// Shared by OverviewTab, DayOfOverlay, and the Print Brief so "invited" always
// means the same thing everywhere a sub-event count is shown.
export function getInvitedPeopleForSection(households, people, section) {
  const invitedHHIds = new Set(households.filter(h => isInvited(h, section)).map(h => h.id));
  return people.filter(p => invitedHHIds.has(p.householdId));
}

// People explicitly confirmed attending this section, via each person's own
// attendingSections. Independent of household-level invite status by design --
// a person only shows here once someone has actually checked their box.
export function getConfirmedPeopleForSection(people, section) {
  return people.filter(p => (p.attendingSections || []).includes(section.id));
}

// Resolves the event's designated main event from the timeline, falling back
// to the first entry if none is explicitly flagged -- the same guard already
// used independently in OverviewTab.jsx and DayOfOverlay.jsx, now shared so
// "the main event" never silently resolves to null in an event that just
// hasn't set the flag yet.
export function resolveMainEvent(timeline) {
  return (timeline || []).find(e => e.isMainEvent) || (timeline || [])[0] || null;
}
