// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.7.0 — utils/eventSeeds.js
// Sub-events suggested when an event is created, by event type, and the
// timeline entries built from them. Entries use the same shape as the ones the
// Admin timeline writes, so per-sub-event RSVP works from day one.
// ─────────────────────────────────────────────────────────────────────────────

import { MITZVAH_TYPES } from "@/constants/events.js";

// Sub-events that serve a meal are flagged so catering counts work immediately.
const MEAL_NAMES = new Set(["kiddush", "reception"]);

const MITZVAH_SEED = ["Service", "Kiddush", "Reception"];

const SEEDS = {
  "wedding":     ["Ceremony", "Reception"],
  "baby-naming": ["Ceremony", "Reception"],
  "graduation":  ["Ceremony", "Celebration"],
  "anniversary": ["Celebration"],
  "birthday":    ["Celebration"],
  "other":       ["Celebration"],
};

export function seedSubEventNames(type) {
  if (MITZVAH_TYPES.has(type)) return [...MITZVAH_SEED];
  return [...(SEEDS[type] || SEEDS.other)];
}

function newTimelineId() {
  return "tl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

// names: the (possibly edited) sub-event titles in order. The first is the main
// event, so the countdown has something to count to. Date and venue apply to all.
export function buildSeedTimeline(names, date, venue) {
  return names
    .map(n => n.trim())
    .filter(Boolean)
    .map((title, i) => ({
      id:          newTimelineId(),
      isMainEvent: i === 0,
      title,
      startDate:   date || "",
      endDate:     date || "",
      startTime:   "",
      endTime:     "",
      venue:       venue || "",
      notes:       "",
      ...(MEAL_NAMES.has(title.toLowerCase()) ? { servesMeal: true } : {}),
    }));
}
