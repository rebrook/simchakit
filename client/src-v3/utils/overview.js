// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.9.0 — utils/overview.js
// Pure helpers for the rebuilt Overview: which stage the event is in, the celebration schedule
// (built from the existing timeline entries), the runway milestones, the "Copy schedule" text,
// and the Readiness takeaways. No React, no network.
// ─────────────────────────────────────────────────────────────────────────────

import { formatTime12 } from "@/utils/dates.js";

const DAY = 86400000;

export function localIso(d = new Date()) {
  // YYYY-MM-DD in the viewer's own time zone
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dayNum = (iso) => Math.round(new Date(iso + "T00:00:00").getTime() / DAY);
export const daysBetween = (fromIso, toIso) => dayNum(toIso) - dayNum(fromIso);

/**
 * Stage of the Overview hero, from the main event date:
 *   "new"   no guests yet (day zero), event not over
 *   "pre"   planning
 *   "soon"  the final two weeks (shown as planning, with the next gathering on the Next line)
 *   "today" the day
 *   "post"  after the event ("completed" means the main event date is in the past)
 */
export function overviewStage({ mainDate, guestCount, todayIso = localIso() }) {
  if (mainDate) {
    const d = daysBetween(todayIso, mainDate);
    if (d < 0) return "post";
    if (d === 0) return "today";
    if (guestCount === 0) return "new";
    if (d <= 14) return "soon";
    return "pre";
  }
  return guestCount === 0 ? "new" : "pre";
}

const longDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const shortMonthDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const toMinutes = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

// First day of the celebration: the Friday of a Friday-to-Sunday main date, otherwise the main date.
export function celebrationStart(mainDate) {
  if (!mainDate) return "";
  const dow = new Date(mainDate + "T00:00:00").getDay();   // 0 Sun .. 6 Sat
  const back = dow === 6 ? 1 : dow === 0 ? 2 : 0;
  const d = new Date(mainDate + "T00:00:00");
  d.setDate(d.getDate() - back);
  return localIso(d);
}

/**
 * The celebration schedule from the timeline entries (the same source as Calendar). Entries from
 * the first day of the celebration on are grouped by day; earlier ones go in `earlier`.
 * Each row carries what the card shows; the headcount comes from `headcountOf(entry)`.
 */
export function buildSchedule({ timeline, mainDate, headcountOf, todayIso = localIso(), nowMinutes = null }) {
  const entries = (timeline || [])
    .filter(e => e && e.startDate)
    .sort((a, b) => `${a.startDate}${a.startTime || "99:99"}`.localeCompare(`${b.startDate}${b.startTime || "99:99"}`));
  const start = celebrationStart(mainDate) || (entries[0]?.startDate || "");
  const toRow = (e) => {
    const hc = headcountOf ? headcountOf(e) : null;
    return {
      id: e.id, title: e.title || "Event", date: e.startDate,
      time: e.startTime ? formatTime12(e.startTime) : "", startTime: e.startTime || "",
      building: e.venue || "", room: e.room || "", address: e.address || "",
      family: e.audience === "family",
      arriveBy: e.arriveBy ? formatTime12(e.arriveBy) : "",
      confirmed: hc ? hc.confirmed : null,
      invited: hc?.invited?.total ?? 0,
      daysAway: daysBetween(todayIso, e.startDate),
      isMain: !!e.isMainEvent,
    };
  };
  const group = (rows) => {
    const days = [];
    rows.forEach(r => {
      let d = days[days.length - 1];
      if (!d || d.date !== r.date) { d = { date: r.date, label: longDay(r.date), rows: [] }; days.push(d); }
      d.rows.push(r);
    });
    return days;
  };
  const rows = entries.map(toRow);
  const main = rows.filter(r => r.date >= start);
  const earlier = rows.filter(r => r.date < start);
  // On the day: past rows read Done and the next one is "Up next".
  if (nowMinutes !== null) {
    const todays = main.filter(r => r.date === todayIso);
    const next = todays.find(r => r.startTime && toMinutes(r.startTime) > nowMinutes);
    main.forEach(r => {
      if (r.date < todayIso) r.state = "done";
      else if (r.date === todayIso) r.state = next ? (r === next ? "next" : (toMinutes(r.startTime) <= nowMinutes ? "done" : "later")) : "done";
    });
  }
  return { days: group(main), earlier: group(earlier), count: main.length, dayCount: new Set(main.map(r => r.date)).size };
}

// Plain text for Copy schedule: day headings, time, name, building and room, then each building's
// address once. Family-only entries are left out.
export function scheduleText({ eventName, days }) {
  const lines = [eventName || "Schedule", ""];
  const addresses = new Map();
  days.forEach(d => {
    const rows = d.rows.filter(r => !r.family);
    if (!rows.length) return;
    lines.push(d.label);
    rows.forEach(r => {
      const where = [r.building, r.room].filter(Boolean).join(", ");
      lines.push(`${r.time ? r.time + "  " : ""}${r.title}${where ? ", " + where : ""}`);
      if (r.building && r.address && !addresses.has(r.building)) addresses.set(r.building, r.address);
    });
    lines.push("");
  });
  if (addresses.size) {
    lines.push("Addresses");
    addresses.forEach((addr, name) => lines.push(`${name}: ${addr}`));
  }
  return lines.join("\n").trim();
}

/**
 * Runway milestones from dates the app holds: invitation send dates (message_log), the RSVP
 * deadline, and timeline entries before the main date. Starts at the earliest milestone or 90 days
 * before the event, whichever is later; at most five markers, the rest merged into "+N more".
 * Returns { items: [{ key, date, label, pos, state }], more, progress, todayPos } with pos 0..100.
 */
export function buildRunway({ mainDate, todayIso = localIso(), invitationDates = [], rsvpDeadline = "", timeline = [] }) {
  if (!mainDate) return null;
  const ms = [];
  if (invitationDates.length) ms.push({ key: "inv", date: [...invitationDates].sort()[0], label: "Invitations sent" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(rsvpDeadline || "") && rsvpDeadline < mainDate) ms.push({ key: "rsvp", date: rsvpDeadline, label: "Reply deadline" });
  const start0 = celebrationStart(mainDate);
  (timeline || []).forEach(e => { if (e?.startDate && e.startDate < start0) ms.push({ key: `t-${e.id}`, date: e.startDate, label: e.title || "Event" }); });
  ms.sort((a, b) => a.date.localeCompare(b.date));
  const earliest = ms[0]?.date || mainDate;
  const ninety = localIso(new Date(new Date(mainDate + "T00:00:00").getTime() - 90 * DAY));
  const from = earliest > ninety ? earliest : ninety;
  const inRange = ms.filter(m => m.date >= from);
  const total = Math.max(1, daysBetween(from, mainDate));
  const pos = (iso) => Math.max(0, Math.min(100, (daysBetween(from, iso) / total) * 100));
  const todayPos = pos(todayIso);
  const MAX = 4;   // plus "The day" makes five
  const shown = inRange.slice(0, MAX);
  const items = shown.map(m => ({ ...m, pos: pos(m.date), state: m.date <= todayIso ? "done" : "todo" }));
  return { items, more: Math.max(0, inRange.length - MAX), from, todayPos: Math.min(todayPos, 100), todayIso, mainDate, empty: ms.length === 0 };
}

// Short takeaway lines for the Readiness card.
export function readinessTakeaways({ mealsChosen, mealsTotal, budgetPaid, budgetTotal, tasksDone, tasksTotal, tasksDueWeek, tasksOverdue, vendorsBooked, vendorsTotal }) {
  const k = (n) => n >= 10000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(n).toLocaleString()}`;
  const left = Math.max(0, budgetTotal - budgetPaid);
  return {
    meals:   mealsTotal === 0 ? "No guests added" : mealsTotal - mealsChosen > 0 ? `${mealsTotal - mealsChosen} still to choose` : "All chosen",
    budget:  budgetTotal === 0 ? "No budget set" : left > 0.5 ? `${k(left)} to go` : "Fully paid",
    tasks:   tasksTotal === 0 ? "No tasks yet" : tasksOverdue > 0 ? `${tasksOverdue} overdue` : tasksDueWeek > 0 ? `${tasksDueWeek} due this week` : tasksDone >= tasksTotal ? "All done" : "None due this week",
    vendors: vendorsTotal === 0 ? "No vendors yet" : vendorsBooked >= vendorsTotal ? "All booked" : `${vendorsTotal - vendorsBooked} still to book`,
  };
}
