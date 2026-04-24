// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.5.0 — api/calendar/[token].js
// Vercel serverless function — public, no auth required.
// GET /api/calendar/[token].ics
// Looks up event by calendar_token, builds ICS from all 5 sources,
// returns text/calendar response suitable for webcal:// subscription.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── ICS helpers ───────────────────────────────────────────────────────────────
function icsEsc(s) {
  return (s || "").replace(/[\\;,]/g, c => "\\" + c).replace(/\n/g, "\\n");
}

function toICSDate(dateStr) {
  return (dateStr || "").replace(/-/g, "");
}

function nextDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}

function buildVEvent({ uid, date, title, description }) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}@simchakit`,
    `DTSTART;VALUE=DATE:${toICSDate(date)}`,
    `DTEND;VALUE=DATE:${nextDay(date)}`,
    `SUMMARY:${icsEsc(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${icsEsc(description)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

// ── Event aggregator — mirrors buildCalendarEvents logic ─────────────────────
function buildEvents(state, adminConfig) {
  const vevents = [];
  const tasks    = (state.tasks    || []).filter(t => !t.dismissed);
  const expenses = state.expenses  || [];
  const vendors  = state.vendors   || [];
  const prep     = state.prep      || [];
  const timeline = adminConfig?.timeline || [];

  const taskCovers = (title) =>
    tasks.some(t => (t.task || "").toLowerCase().includes((title || "").toLowerCase()));

  // Timeline
  timeline.forEach(e => {
    if (!e.startDate) return;
    vevents.push(buildVEvent({
      uid:         `tl-${e.id || e.title}`,
      date:        e.startDate,
      title:       e.title || "Event",
      description: [e.startTime, e.endTime ? `${e.startTime}-${e.endTime}` : "", e.venue, e.notes].filter(Boolean).join(" · "),
    }));
  });

  // Tasks
  tasks.filter(t => t.due && !t.done).forEach(t => {
    vevents.push(buildVEvent({
      uid:         `task-${t.id}`,
      date:        t.due,
      title:       t.task || "Task",
      description: t.category || "",
    }));
  });

  // Payments
  expenses.filter(e => e.dueDate && !e.paid).forEach(e => {
    const amt = parseFloat(e.amount) || 0;
    vevents.push(buildVEvent({
      uid:         `pay-${e.id}`,
      date:        e.dueDate,
      title:       e.description || "Payment",
      description: [e.vendor || e.category, amt > 0 ? `$${amt.toLocaleString()}` : ""].filter(Boolean).join(" · "),
    }));
  });

  // Vendor milestones
  vendors.forEach(v => {
    (v.milestones || []).forEach(m => {
      if (!m.date || taskCovers(m.title)) return;
      vevents.push(buildVEvent({
        uid:         `ms-${v.id}-${m.id}`,
        date:        m.date,
        title:       m.title || "Milestone",
        description: [v.name, m.notes].filter(Boolean).join(" · "),
      }));
    });
  });

  // Prep target dates
  prep.filter(p => p.targetDate && p.status !== "Complete").forEach(p => {
    if (taskCovers(p.title)) return;
    vevents.push(buildVEvent({
      uid:         `prep-${p.id}`,
      date:        p.targetDate,
      title:       p.title || "Prep item",
      description: [p.category, p.status].filter(Boolean).join(" · "),
    }));
  });

  return vevents.sort((a, b) => {
    const da = a.match(/DTSTART;VALUE=DATE:(\d{8})/)?.[1] || "";
    const db = b.match(/DTSTART;VALUE=DATE:(\d{8})/)?.[1] || "";
    return da.localeCompare(db);
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Extract token from URL — strips trailing .ics if present
  const raw   = req.query.token || "";
  const token = raw.replace(/\.ics$/i, "");

  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  // Look up event by calendar_token
  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, admin_config, archived")
    .eq("calendar_token", token)
    .single();

  if (error || !event) {
    return res.status(404).send("Calendar not found.");
  }

  // Load all collections for this event
  const COLLECTIONS = ["tasks", "expenses", "vendors", "prep"];
  const results = await Promise.all(
    COLLECTIONS.map(col =>
      supabase.from(col).select("data").eq("event_id", event.id)
        .then(({ data }) => ({ col, rows: (data || []).map(r => r.data) }))
    )
  );

  const state = {};
  results.forEach(({ col, rows }) => { state[col] = rows; });

  const adminConfig = event.admin_config || {};
  const vevents     = buildEvents(state, adminConfig);
  const calName     = adminConfig.name || event.name || "SimchaKit";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SimchaKit//SimchaKit Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEsc(calName)}`,
    "X-WR-TIMEZONE:America/New_York",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${calName.replace(/\s+/g,"-").toLowerCase()}-calendar.ics"`);
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(ics);
}
