// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.41.0: utils/guestsPreset.js
// One-shot handoff so a link elsewhere in the app (the Overview timeline's
// awaiting count) can open the Guests tab already filtered to the guests who
// still owe an answer. Tabs only receive an id from setActiveTab, so the
// filter is parked here, tagged with the event it was set for, and the Guests
// tab reads and clears it when it mounts.
// ─────────────────────────────────────────────────────────────────────────────

let preset = null;

export function setGuestsPreset(eventId, sectionIds) {
  preset = { eventId, sectionIds: [...(sectionIds || [])] };
}

// Returns the preset only if it was set for this event, and clears it either way.
export function consumeGuestsPreset(eventId) {
  const p = preset && preset.eventId === eventId ? preset : null;
  preset = null;
  return p;
}
