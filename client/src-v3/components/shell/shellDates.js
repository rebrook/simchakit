// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.

// ── Date helpers for sidebar event switcher ─────────────────────────────────
export function formatSwitcherDate(timeline) {
  if (!timeline || !timeline.length) return null;
  const main = timeline.find(e => e.isMainEvent) || timeline[0];
  const raw = main?.startDate || main?.date;
  if (!raw) return null;
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  // Calendar days from today's midnight (V5.9.1), so this agrees with the Overview countdown and
  // the day-of banner instead of dropping a day depending on the time of day.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
  if (diffDays < 0) return `${dateStr} \u00b7 ${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return `${dateStr} \u00b7 Today`;
  return `${dateStr} \u00b7 ${diffDays}d out`;
}

// ── Day-of reminder banner helpers (mobile only) ────────────────────────────
// daysToEvent mirrors utils/focus.js's own calc exactly (same mainEvent
// lookup, same strip-time-to-midnight diff) so the two never disagree.
// focus.js doesn't export its version, so this is a deliberate duplicate,
// not a drift risk, as long as both stay in step with the comment above.
export function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDaysToEvent(timeline) {
  const today = stripTime(new Date());
  const mainEvent = (timeline || []).find(e => e.isMainEvent) || null;
  const eventDate = mainEvent?.startDate ? new Date(mainEvent.startDate + "T00:00:00") : null;
  return eventDate ? Math.ceil((eventDate - today) / 86400000) : null;
}

// Local (not UTC) Y-M-D string, so the dismissal boundary lines up with the
// same midnight getDaysToEvent() already uses, instead of drifting near
// midnight the way toISOString()'s UTC date would.
export function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
