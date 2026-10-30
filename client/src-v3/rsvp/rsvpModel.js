// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.4.0 — rsvp/rsvpModel.js
// Pure helpers for the guest RSVP page: the in-progress draft, validation, the POST
// body, the summary, dates and calendar files. No React and no network here.
//
// Draft shape:
//   answers:  { [personId]: { [sectionId]: "yes" | "no" | "unsure" | null } }
//   details:  { [personId]: { mealChoice, dietary, kosher } }
//   address:  { address1, address2, city, stateProvince, postalCode, country }
//   addressMode: "correct" | "update" | null     note: string     newGuests: [{ firstName, lastName, isChild }]
// ─────────────────────────────────────────────────────────────────────────────

import { generateICS } from "@/utils/calendar.js";

const ADDRESS_KEYS = ["address1", "address2", "city", "stateProvince", "postalCode", "country"];
const SESSION_KEY = "simchakit-rsvp-draft";

// ── Draft ─────────────────────────────────────────────────────────────────────
export function initDraft(view) {
  const people = view.people || [];
  const options = view.mealOptions || [];
  return {
    answers: Object.fromEntries(people.map(p => [p.id, { ...(p.answers || {}) }])),
    details: Object.fromEntries(people.map(p => [p.id, {
      // A stored meal that is no longer an option would be rejected by the server: start blank.
      mealChoice: options.includes(p.mealChoice) ? p.mealChoice : "",
      dietary: p.dietary || "",
      kosher: !!p.kosher,
    }])),
    address: { ...Object.fromEntries(ADDRESS_KEYS.map(k => [k, ""])), ...(view.household?.address || {}) },
    addressMode: null,
    note: view.note || "",
    newGuests: [],
  };
}

// Remembers in-progress answers for this tab only (sessionStorage; no cookies, no account).
// Stored with the token it belongs to and the reply it was started from, so a stale
// draft is never applied after the household has since replied.
export function saveDraft(token, baseSubmittedAt, draft, step) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, baseSubmittedAt: baseSubmittedAt || null, draft, step })); } catch { /* private mode: fine */ }
}
export function loadSavedDraft(token, baseSubmittedAt) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (saved && saved.token === token && (saved.baseSubmittedAt || null) === (baseSubmittedAt || null)) return saved;
  } catch { /* ignore */ }
  return null;
}
export function clearSavedDraft() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

// ── Questions ─────────────────────────────────────────────────────────────────
export const answerTotal = (view) => (view.people?.length || 0) * (view.sections?.length || 0);

export function unanswered(view, draft) {
  const out = [];
  for (const person of view.people) {
    for (const section of view.sections) {
      if (!draft.answers[person.id]?.[section.id]) out.push({ person, section });
    }
  }
  return out;
}

// People who need a meal choice: said yes to a sub-event where a meal is served. If the
// host has not flagged any meal-serving sub-event, anyone who said yes to anything.
export function mealPeople(view, draft) {
  const mealSections = view.sections.filter(s => s.servesMeal);
  const scope = mealSections.length ? mealSections : view.sections;
  return view.people.filter(p => scope.some(s => draft.answers[p.id]?.[s.id] === "yes"));
}

export function setAll(view, draft, status) {
  const answers = {};
  view.people.forEach(p => { answers[p.id] = Object.fromEntries(view.sections.map(s => [s.id, status])); });
  return { ...draft, answers };
}

export function copyAnswers(draft, fromId, toId) {
  return { ...draft, answers: { ...draft.answers, [toId]: { ...draft.answers[fromId] } } };
}

// ── POST body ─────────────────────────────────────────────────────────────────
export function buildPayload(view, draft) {
  const answers = [];
  for (const person of view.people) {
    for (const section of view.sections) {
      const status = draft.answers[person.id]?.[section.id];
      if (status) answers.push({ personId: person.id, sectionId: section.id, status });
    }
  }
  const needMeal = new Set(mealPeople(view, draft).map(p => p.id));
  const details = view.people.map(p => {
    const d = draft.details[p.id] || {};
    return {
      personId: p.id,
      mealChoice: needMeal.has(p.id) && view.mealOptions.includes(d.mealChoice) ? d.mealChoice : "",
      dietary: String(d.dietary || "").trim(),
      kosher: !!d.kosher,
    };
  });
  const body = { answers, details, note: String(draft.note || "").trim() };
  if (draft.addressMode === "update") {
    body.address = Object.fromEntries(ADDRESS_KEYS.map(k => [k, String(draft.address[k] || "").trim()]));
  }
  const guests = (draft.newGuests || [])
    .map(g => ({ firstName: String(g.firstName || "").trim(), lastName: String(g.lastName || "").trim(), isChild: !!g.isChild }))
    .filter(g => g.firstName);
  if (guests.length) body.newGuests = guests;
  return body;
}

// ── Summary ───────────────────────────────────────────────────────────────────
export function summarize(view, draft) {
  return view.sections.map(section => {
    const group = { section, yes: [], no: [], unsure: [], none: [] };
    view.people.forEach(p => {
      const v = draft.answers[p.id]?.[section.id];
      (v === "yes" ? group.yes : v === "no" ? group.no : v === "unsure" ? group.unsure : group.none).push(p.firstName);
    });
    return group;
  });
}

// ── Dates ─────────────────────────────────────────────────────────────────────
export function formatDate(iso, opts = { weekday: "long", year: "numeric", month: "long", day: "numeric" }) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", opts);
}
export const formatShortDate = (iso) => formatDate(iso, { month: "long", day: "numeric" });

function formatTime(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export function formatTimeRange(start, end) {
  const a = formatTime(start), b = formatTime(end);
  return a && b ? `${a} to ${b}` : a || "";
}

// ── Calendar (.ics) ───────────────────────────────────────────────────────────
export function calendarFile(view, sections) {
  const events = sections.filter(s => s.startDate).map(s => ({
    id: `rsvp-${s.id}`, date: s.startDate, startTime: s.startTime, endTime: s.endTime,
    title: `${s.title} (${view.event.name})`, location: s.venue || view.event.venue || "", meta: view.event.name, source: "RSVP",
  }));
  return generateICS(events, view.event.name);
}

// The Event details page (V5-G1): every sub-event the household is invited to, with where and what to
// wear. Same UIDs as calendarFile, so adding both updates the entries rather than doubling them.
export function infoCalendarFile(view, items) {
  const events = items.filter(s => s.startDate).map(s => ({
    id: `rsvp-${s.id}`, date: s.startDate, startTime: s.startTime, endTime: s.endTime,
    title: `${s.title} (${view.event.name})`,
    location: [s.venue, s.addressLine].filter(Boolean).join(", ") || view.event.venue || "",
    meta: [view.event.name, s.dressCode && `Dress code: ${s.dressCode}`, s.parkingNote && `Parking: ${s.parkingNote}`].filter(Boolean).join("\n"),
    source: "RSVP",
  }));
  return generateICS(events, view.event.name);
}

export function downloadIcs(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (s) => String(s || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "event";
