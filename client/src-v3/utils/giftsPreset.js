// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.8.2: utils/giftsPreset.js
// One-shot handoff so Overview's thank-you row opens the Gifts tab already filtered to the
// notes still to write (or to mail). Same idea as utils/guestsPreset.js: tabs only receive an
// id from setActiveTab, so the filter is parked here, tagged with its event, and the Gifts tab
// reads and clears it when it mounts.
// ─────────────────────────────────────────────────────────────────────────────

let preset = null;

// filter: "needs-written" | "needs-mailed" (the values the Gifts thank-you filter already uses)
export function setGiftsFilter(eventId, filter) { preset = { eventId, filter }; }

export function consumeGiftsFilter(eventId) {
  const f = preset && preset.eventId === eventId ? preset.filter : null;
  preset = null;
  return f;
}
