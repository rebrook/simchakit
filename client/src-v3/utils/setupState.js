// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.7.0 — utils/setupState.js
// Progress of the "Getting ready" card, saved on the event (events.setup_state,
// V5.2-F1.sql) so co-planners see the same state on every device.
//
//   setup_state = { steps: { [stepId]: "done" | "skipped" }, dismissed, legacyChecked }
//
// A step is also done when the event's own data says so (guests added, a logo
// set, ...), so existing events need no backfill.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase.js";
import { resolveMainEvent } from "@/utils/sections.js";

export const SETUP_STEPS = [
  { id: "event",        label: "Event created" },
  { id: "events-venue", label: "Events and venue" },
  { id: "guests",       label: "Add your guests" },
  { id: "coplanner",    label: "Invite a co-planner" },
  { id: "look",         label: "Pick your color and logo" },
];

const EMPTY = { steps: {}, dismissed: false };

export function normalizeSetupState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    ...s,
    steps:     s.steps && typeof s.steps === "object" ? s.steps : {},
    dismissed: s.dismissed === true,
  };
}

// Returns the normalized state, or null when the column cannot be read
// (migration not run yet), so the card stays hidden instead of misleading.
export async function readSetupState(eventId) {
  const { data, error } = await supabase
    .from("events").select("setup_state").eq("id", eventId).maybeSingle();
  if (error || !data) return null;
  return normalizeSetupState(data.setup_state);
}

// Read-merge-write: fetch the latest row, apply only the keys this change
// touches, then save. A step value of null clears it. Two co-planners changing
// different steps do not overwrite each other.
export async function mergeSetupState(eventId, patch) {
  const current = (await readSetupState(eventId)) || { ...EMPTY };
  const steps = { ...current.steps };
  for (const [id, v] of Object.entries(patch.steps || {})) {
    if (v == null) delete steps[id]; else steps[id] = v;
  }
  const next = { ...current, steps };
  if (patch.dismissed !== undefined)     next.dismissed     = !!patch.dismissed;
  if (patch.legacyChecked !== undefined) next.legacyChecked = !!patch.legacyChecked;
  const { error } = await supabase.from("events").update({ setup_state: next }).eq("id", eventId);
  if (error) throw error;
  return normalizeSetupState(next);
}

// One-time move of the old per-browser dismissal onto the event. Returns the
// new state when it wrote, otherwise null. The key is removed after a
// successful write and never read again.
export async function migrateLegacyDismissal(eventId, state) {
  if (!state || state.legacyChecked) return null;
  const key = `simchakit-getstarted-dismissed-${eventId}`;
  let legacy = false;
  try { legacy = localStorage.getItem(key) === "1"; } catch { /* storage blocked */ }
  if (!legacy) return null;
  const next = await mergeSetupState(eventId, { dismissed: true, legacyChecked: true });
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  return next;
}

// Per-step status: "done" | "skipped" | "todo".
export function resolveSteps({ adminConfig, households, coPlanners, userId, setupState }) {
  const stored   = setupState?.steps || {};
  const timeline = adminConfig?.timeline || [];
  const main     = resolveMainEvent(timeline);
  const others   = (coPlanners || []).filter(c => c.user_id !== userId);

  const derived = {
    "event":        true,
    "events-venue": timeline.length >= 2 || !!main?.venue,
    "guests":       (households || []).length > 0,
    "coplanner":    others.length > 0,
    "look":         (!!adminConfig?.theme?.palette && adminConfig.theme.palette !== "rose") || !!adminConfig?.logoUrl,
  };

  const status = {};
  for (const s of SETUP_STEPS) {
    if (derived[s.id] || stored[s.id] === "done") status[s.id] = "done";
    else if (stored[s.id] === "skipped")          status[s.id] = "skipped";
    else                                           status[s.id] = "todo";
  }
  const remaining = SETUP_STEPS.filter(s => status[s.id] === "todo").length;
  const doneCount = SETUP_STEPS.filter(s => status[s.id] === "done").length;
  return { status, remaining, doneCount, total: SETUP_STEPS.length };
}
