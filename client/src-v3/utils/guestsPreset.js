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

// One-shot "open this Guests view" (V5-R3): the Overview's New replies item opens the
// Guests tab straight on the reply queue. Same hand-off idea as the filter preset above.
let openView = null;
export function setGuestsView(eventId, view) { openView = { eventId, view }; }
export function consumeGuestsView(eventId) {
  const v = openView && openView.eventId === eventId ? openView.view : null;
  openView = null;
  return v;
}

// One-shot "open the composer with these households" (V5-R4): the Overview's reminder card
// opens the composer on the Guests tab with the unreplied households already chosen.
let composePreset = null;
export function setGuestsCompose(eventId, kind, ids) { composePreset = { eventId, kind, ids: [...(ids || [])] }; }
export function consumeGuestsCompose(eventId) {
  const c = composePreset && composePreset.eventId === eventId ? composePreset : null;
  composePreset = null;
  return c;
}

// Returns the preset only if it was set for this event, and clears it either way.
export function consumeGuestsPreset(eventId) {
  const p = preset && preset.eventId === eventId ? preset : null;
  preset = null;
  return p;
}
