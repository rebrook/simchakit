// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0: utils/calendarFocus.js
// One-shot handoff so a row of the Overview's celebration schedule opens that entry's details in
// the Calendar tab. Same idea as utils/guestsPreset.js: tabs only receive an id from
// setActiveTab, so the entry is parked here, tagged with its event, and Calendar reads and
// clears it once its events are built.
// ─────────────────────────────────────────────────────────────────────────────

let focus = null;

export function setCalendarFocus(eventId, entryId) { focus = { eventId, entryId }; }

export function consumeCalendarFocus(eventId) {
  const f = focus && focus.eventId === eventId ? focus.entryId : null;
  focus = null;
  return f;
}
