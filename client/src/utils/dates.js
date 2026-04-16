// Date and time formatting utilities

function getCountdown(targetDate) {
  const now    = new Date();
  const target = new Date(targetDate + "T00:00:00");
  const diffMs = target - now;
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  const total   = diffMs;
  const days    = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, total };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime12(t) {
  // "09:30" → "9:30 AM", "13:00" → "1:00 PM"
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr), m = parseInt(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTimeRange(startTime, endTime) {
  const s = formatTime12(startTime);
  const e = formatTime12(endTime);
  if (s && e) return `${s} – ${e}`;
  return s || "";
}

function formatEntryMeta(entry) {
  const parts = [];
  if (entry.startDate) {
    const d = new Date(entry.startDate + "T00:00:00");
    parts.push(d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" }));
  }
  const timeStr = formatTimeRange(entry.startTime, entry.endTime);
  if (timeStr) parts.push(timeStr);
  if (entry.venue) parts.push(entry.venue);
  return parts.join(" · ");
}

function sortTimeline(entries) {
  return [...entries].sort((a, b) => {
    const sd = (a.startDate||"").localeCompare(b.startDate||"");
    if (sd !== 0) return sd;
    const st = (a.startTime||"").localeCompare(b.startTime||"");
    if (st !== 0) return st;
    return (a.title||"").localeCompare(b.title||"");
  });
}

function parseTimeParts(t) {
  if (!t) return { h: "", m: "", ap: "" };
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { h: "", m: "", ap: "" };
  let h = parseInt(match[1]);
  const ap = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { h: String(h), m: match[2], ap };
}

function buildTime(h, m, ap) {
  if (!h || !m || !ap) return "";
  let hr = parseInt(h);
  if (ap === "PM" && hr !== 12) hr += 12;
  if (ap === "AM" && hr === 12) hr = 0;
  return `${String(hr).padStart(2,"0")}:${m}`;
}

export {
  getCountdown,
  formatDate,
  formatTime12,
  formatTimeRange,
  formatEntryMeta,
  sortTimeline,
  parseTimeParts,
  buildTime,
};
