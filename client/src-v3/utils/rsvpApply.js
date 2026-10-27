// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.5.0 — utils/rsvpApply.js
// The rules for turning a guest's RSVP reply (a proposal in rsvp_replies) into guest
// data, and for undoing it. Pure functions: no React, no network. The Reply queue
// (components/guests/ReplyQueue.jsx) does the saving.
//
// What an accepted reply writes, and only this (existing fields only):
//   person.sectionRsvp   "Yes" / "No" per sub-event. Not sure resets that sub-event to
//                        TBD (no entry), because TBD is the app's "not confirmed either way".
//   person.mealChoice    only when the guest picked one (a blank never clears a meal)
//   person.dietary, person.kosher   as sent
//   household address    only the fields the guest changed (a reply with no address means "correct")
//   household.rsvpStatus derived from the answers: RSVP Yes if anyone is coming to anything;
//                        RSVP No if every person said No to everything; Maybe if nobody is
//                        coming but someone is not sure; otherwise left as it was. An explicit
//                        per-sub-event status already set on the household follows the same rule.
//   household.contactLog the guest's note, as a log entry (so it is not lost once accepted)
//   new people           guests the household added (these make a reply "Needs a look")
//
// personId in a reply is the people table's row id (_rowId in the app), not the id
// stored inside the person's data. A reply's household_id is the households row id.
//
// The snapshot holds the values an accept replaced, so Undo restores them exactly.
// ─────────────────────────────────────────────────────────────────────────────

import { newPersonId, newContactId } from "@/utils/ids.js";

const ADDRESS_KEYS = ["address1", "address2", "city", "stateProvince", "postalCode", "country"];
const ABSENT = { $absent: true };   // marks "this field did not exist before" in a snapshot

const fromStored = (v) => (v === "Yes" ? "yes" : v === "No" ? "no" : null);
const toStored   = (v) => (v === "yes" ? "Yes" : v === "no" ? "No" : null);   // unsure -> TBD (no entry)

const personName = (p) => p?.firstName || (p?.name || "").split(" ")[0] || "Guest";
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const str = (v) => String(v ?? "").trim();

export const STATUS_LABEL = { yes: "Yes", no: "No", unsure: "Not sure" };

// ── Planning (pure) ───────────────────────────────────────────────────────────
// Returns what accepting would write and the snapshot to undo it. Nothing is saved here.
//   ctx: { household (item with _rowId), people (all people items), sections (timeline entries) }
export function planApply(reply, ctx) {
  const payload = reply.payload || {};
  const { household } = ctx;
  const members = ctx.people.filter(p => p.householdId === household.id);
  const byRowId = new Map(members.map(p => [p._rowId, p]));

  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const details = Array.isArray(payload.details) ? payload.details : [];
  const missingPeople = [...new Set([...answers, ...details].map(a => a.personId).filter(id => !byRowId.has(id)))];

  // People: copy, then write the guest's answers and details.
  const afterByRowId = new Map();
  const snapPeople = new Map();   // rowId -> before (only the fields this reply touches)
  const touch = (rowId, field) => {
    const base = byRowId.get(rowId);
    if (!base) return null;
    if (!afterByRowId.has(rowId)) afterByRowId.set(rowId, clone(base));
    if (!snapPeople.has(rowId)) snapPeople.set(rowId, {});
    const before = snapPeople.get(rowId);
    if (!(field in before)) before[field] = base[field] === undefined ? ABSENT : clone(base[field]);
    return afterByRowId.get(rowId);
  };

  for (const a of answers) {
    const person = touch(a.personId, "sectionRsvp");
    if (!person) continue;
    const next = { ...(person.sectionRsvp || {}) };
    const stored = toStored(a.status);
    if (stored) next[a.sectionId] = stored; else delete next[a.sectionId];
    person.sectionRsvp = next;
  }
  for (const d of details) {
    if (typeof d.mealChoice === "string" && d.mealChoice !== "") { const p = touch(d.personId, "mealChoice"); if (p) p.mealChoice = d.mealChoice; }
    if (typeof d.dietary === "string")  { const p = touch(d.personId, "dietary"); if (p) p.dietary = d.dietary; }
    if (typeof d.kosher === "boolean")  { const p = touch(d.personId, "kosher");  if (p) p.kosher = d.kosher; }
  }

  // Household: address, derived status, note.
  const householdAfter = clone(household);
  const snapHousehold = {};
  const touchH = (field) => { if (!(field in snapHousehold)) snapHousehold[field] = household[field] === undefined ? ABSENT : clone(household[field]); };

  const addressChanges = [];
  if (payload.address && typeof payload.address === "object") {
    for (const k of ADDRESS_KEYS) {
      if (payload.address[k] === undefined) continue;
      const to = str(payload.address[k]);
      if (to !== str(household[k])) { touchH(k); householdAfter[k] = to; addressChanges.push({ field: k, from: str(household[k]), to }); }
    }
  }

  // Final answers per person after applying (people the reply did not touch keep theirs).
  const finalAnswer = (person, sectionId) => fromStored((afterByRowId.get(person._rowId) || person).sectionRsvp?.[sectionId]);
  const sectionIds = [...new Set(answers.map(a => a.sectionId))];
  const unsureSections = new Set(answers.filter(a => a.status === "unsure").map(a => a.sectionId));
  const derive = (ids) => {
    if (members.length === 0 || ids.length === 0) return null;
    const cells = members.flatMap(p => ids.map(s => finalAnswer(p, s)));
    if (cells.some(v => v === "yes")) return "RSVP Yes";
    if (cells.every(v => v === "no")) return "RSVP No";
    if (ids.some(s => unsureSections.has(s))) return "Maybe";
    return null;
  };

  let statusChange = null;
  if (answers.length > 0) {
    const derived = derive(sectionIds);
    if (derived && derived !== household.rsvpStatus) {
      touchH("rsvpStatus");
      householdAfter.rsvpStatus = derived;
      statusChange = { from: household.rsvpStatus || "", to: derived };
    }
    // An explicit per-sub-event status the host already set follows the same rule.
    const explicit = household.subEventRsvp || {};
    const nextExplicit = { ...explicit };
    let explicitChanged = false;
    for (const sectionId of sectionIds) {
      if (!(sectionId in explicit)) continue;
      const d = derive([sectionId]);
      if (d && d !== explicit[sectionId]) { nextExplicit[sectionId] = d; explicitChanged = true; }
    }
    if (explicitChanged) { touchH("subEventRsvp"); householdAfter.subEventRsvp = nextExplicit; }
  }

  const note = str(payload.note);
  if (note) {
    touchH("contactLog");
    householdAfter.contactLog = [
      { id: newContactId(), date: String(reply.submitted_at || new Date().toISOString()).slice(0, 10), type: "Other", notes: `RSVP note: ${note}` },
      ...(household.contactLog || []),
    ];
  }

  // New people (a guest the household added).
  const newPeople = (Array.isArray(payload.newGuests) ? payload.newGuests : []).map(g => ({
    id: newPersonId(), householdId: household.id,
    firstName: str(g.firstName), lastName: str(g.lastName), title: "", isChild: !!g.isChild,
    isAttending: null, sectionRsvp: {}, tableId: null, shirtSize: "", pantSize: "",
    mealChoice: "", kosher: false, dietary: "", notes: "Added from an RSVP reply",
  }));

  return {
    peopleAfter: [...afterByRowId.entries()].map(([rowId, item]) => ({ rowId, item })),
    householdAfter: Object.keys(snapHousehold).length ? householdAfter : null,
    newPeople,
    missingPeople,
    addressChanges,
    statusChange,
    snapshot: {
      v: 1,
      people: [...snapPeople.entries()].map(([rowId, before]) => ({ rowId, before })),
      household: Object.keys(snapHousehold).length ? { rowId: household._rowId, before: snapHousehold } : null,
      created: [],
    },
  };
}

// ── Diff for display (pure) ───────────────────────────────────────────────────
export function buildReplyDiff(reply, ctx) {
  const payload = reply.payload || {};
  const plan = planApply(reply, ctx);
  const members = ctx.people.filter(p => p.householdId === ctx.household.id);
  const byRowId = new Map(members.map(p => [p._rowId, p]));
  const titleOf = (sid) => ctx.sections.find(s => s.id === sid)?.title || "Sub-event";

  const answers = [];
  let unchanged = 0;
  const counts = { yes: 0, no: 0, unsure: 0 };
  (payload.answers || []).forEach(a => {
    const person = byRowId.get(a.personId);
    if (!person) return;
    counts[a.status] = (counts[a.status] || 0) + 1;
    const from = fromStored(person.sectionRsvp?.[a.sectionId]);
    const to = a.status;
    if ((from || null) === (to === "unsure" ? null : to)) { unchanged++; return; }
    answers.push({ personId: a.personId, name: personName(person), sectionId: a.sectionId, section: titleOf(a.sectionId), from, to });
  });

  const detailChanges = [];
  (payload.details || []).forEach(d => {
    const person = byRowId.get(d.personId);
    if (!person) return;
    if (typeof d.mealChoice === "string" && d.mealChoice !== "" && d.mealChoice !== (person.mealChoice || "")) detailChanges.push({ name: personName(person), field: "Meal", from: person.mealChoice || "", to: d.mealChoice });
    if (typeof d.dietary === "string" && str(d.dietary) !== str(person.dietary)) detailChanges.push({ name: personName(person), field: "Dietary", from: str(person.dietary), to: str(d.dietary) });
    if (typeof d.kosher === "boolean" && d.kosher !== !!person.kosher) detailChanges.push({ name: personName(person), field: "Kosher", from: person.kosher ? "Yes" : "No", to: d.kosher ? "Yes" : "No" });
  });

  const addressState = plan.addressChanges.length ? "changed" : "confirmed";
  const total = counts.yes + counts.no + counts.unsure;
  return {
    answers, unchangedAnswers: unchanged, counts, details: detailChanges,
    address: { state: payload.address === null || payload.address === undefined ? "confirmed" : addressState, changes: plan.addressChanges },
    note: str(payload.note),
    newGuests: plan.newPeople.map(p => ({ firstName: p.firstName, lastName: p.lastName, isChild: p.isChild })),
    missingPeople: plan.missingPeople,
    statusChange: plan.statusChange,
    declined: total > 0 && counts.no === total,
    needsLook: plan.newPeople.length > 0,
    hasChanges: answers.length > 0 || detailChanges.length > 0 || plan.addressChanges.length > 0 || plan.newPeople.length > 0 || !!plan.statusChange,
  };
}

// One-line summary like the mock: "3 yes · 1 no" or "Declined".
export function summaryChip(diff) {
  if (diff.needsLook) return { tone: "look", shape: "▲", label: "Needs a look" };
  if (diff.declined)  return { tone: "no", shape: "✕", label: "Declined" };
  const parts = [];
  if (diff.counts.yes) parts.push(`${diff.counts.yes} yes`);
  if (diff.counts.no) parts.push(`${diff.counts.no} no`);
  if (diff.counts.unsure) parts.push(`${diff.counts.unsure} not sure`);
  return { tone: "yes", shape: "●", label: parts.join(" · ") || "No answers" };
}

// ── Restoring (pure) ──────────────────────────────────────────────────────────
// Given a snapshot and the CURRENT items, returns what to save and what to remove to
// put the touched fields back exactly as they were. Untouched fields (and edits made
// elsewhere since) are left alone.
export function planRestore(snapshot, { household, people }) {
  const setBack = (item, before) => {
    const next = clone(item);
    for (const [field, value] of Object.entries(before)) {
      if (value && value.$absent) delete next[field]; else next[field] = clone(value);
    }
    return next;
  };
  const peopleToSave = [];
  for (const { rowId, before } of snapshot?.people || []) {
    const current = people.find(p => p._rowId === rowId);
    if (current) peopleToSave.push(setBack(current, before));
  }
  const householdToSave = snapshot?.household && household && household._rowId === snapshot.household.rowId
    ? setBack(household, snapshot.household.before) : null;
  return { peopleToSave, householdToSave, peopleToRemove: [...(snapshot?.created || [])] };
}
