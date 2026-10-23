// Moved verbatim from DayOfOverlay.jsx (V4.46.0 module split) — no behavior changes.

// ── Time helpers for now/next detection ──────────────────────────────────────
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  // Accepts "HH:MM", "H:MM AM/PM", "HH:MM AM/PM"
  const cleaned = timeStr.trim().toUpperCase();
  let hours, minutes;

  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = parseInt(ampmMatch[2], 10);
    if (ampmMatch[3] === "PM" && hours !== 12) hours += 12;
    if (ampmMatch[3] === "AM" && hours === 12) hours = 0;
  } else {
    const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (!match24) return null;
    hours = parseInt(match24[1], 10);
    minutes = parseInt(match24[2], 10);
  }
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

// Build a epoch-ms timestamp from a date string + time string (device-local TZ)
export function buildTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.getTime();
}

// Build start/end timestamps for an entry, handling midnight crossing.
//
// Bug fix (V4.36.1): this used to return null/null whenever startTime was
// blank, which made the entry invisible to every consumer below (now/next
// detection, allPast, both run-of-show render paths, and the intra-day sort
// in groupTimelineByDate). A dated-but-untimed entry looked identical to
// one with no date at all. Two cases are handled explicitly instead of
// falling through to null:
//   - No start time at all: treat the entry as all-day (local midnight to
//     the next local midnight) on its date.
//   - Start time given but no end time: default to a 1 hour block. This is
//     a judgment call on duration, not a value the user entered, and the
//     corresponding AdminPanel warning tag exists so it's not a silent
//     assumption.
export function entryTimestamps(entry, fallbackDate) {
  const dateStr = entry.startDate || fallbackDate || null;
  if (!dateStr) return { startMs: null, endMs: null };

  const startMs = buildTimestamp(dateStr, entry.startTime);
  let endMs = buildTimestamp(dateStr, entry.endTime);

  if (startMs === null) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return { startMs: null, endMs: null };
    return { startMs: d.getTime(), endMs: d.getTime() + 24 * 60 * 60 * 1000 };
  }

  if (endMs === null) {
    endMs = startMs + 60 * 60 * 1000;
  } else if (endMs <= startMs) {
    // endTime < startTime means midnight crossing: add 24h to end
    endMs += 24 * 60 * 60 * 1000;
  }
  return { startMs, endMs };
}

// Group timeline entries by date for multi-day events.
// Returns null for single-day events (callers render flat, unchanged).
export function groupTimelineByDate(timeline, fallbackDate, nowMs) {
  const dateMap = {};
  for (const entry of timeline) {
    const d = entry.startDate || fallbackDate;
    if (!d) continue; // skip entries with no resolvable date
    if (!dateMap[d]) dateMap[d] = [];
    dateMap[d].push(entry);
  }

  const dates = Object.keys(dateMap);
  if (dates.length < 2) return null; // single-day: render unchanged

  // Today in device-local YYYY-MM-DD
  const now = new Date(nowMs);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Sort groups by date ascending; entries within by start timestamp
  return dates.sort().map(ds => {
    const entries = dateMap[ds].sort((a, b) => {
      const aMs = entryTimestamps(a, fallbackDate).startMs || 0;
      const bMs = entryTimestamps(b, fallbackDate).startMs || 0;
      return aMs - bMs;
    });
    const d = new Date(ds + "T12:00:00"); // noon avoids DST edge
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const isToday = ds === todayStr;
    const isDayPast = ds < todayStr;
    const label = isToday ? `Today \u00b7 ${weekday}, ${monthDay}` : `${weekday}, ${monthDay}`;
    return { dateStr: ds, label, isToday, isDayPast, entries };
  });
}

export function formatClock() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
