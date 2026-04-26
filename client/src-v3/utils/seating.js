// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — seating.js
// Pure utility functions for seating chart operations.
// No side effects, no Supabase calls, no React.
// ─────────────────────────────────────────────────────────────────────────────

import { getHouseholdAttending } from "./guests.js";

// ── autoSeatByHousehold ───────────────────────────────────────────────────────
//
// Assigns unseated people to tables using greedy First Fit Decreasing bin-packing,
// keeping households together where possible.
//
// Parameters:
//   scopedPeople  — all people confirmed for the active section (attendingSections includes sectionId)
//   sortedTables  — tables scoped to the active section, in display order
//   households    — all household records (for override lookups)
//   sectionId     — the active section id (used to read existing tableAssignments)
//
// Returns:
//   {
//     assignments:  [{ personId, tableId }, ...],
//     splits:       [{ householdName, adultTable, kidsTable }, ...],
//     unplaced:     [{ personName, householdName }, ...],
//     seatedCount:  number,
//     unplacedCount: number,
//   }
//
export function autoSeatByHousehold(scopedPeople, sortedTables, households, sectionId) {
  // ── 0. Helpers ──────────────────────────────────────────────────────────────
  const householdMap = Object.fromEntries(households.map(h => [h.id, h]));

  const getPersonTableId = (p) =>
    (p.tableAssignments && p.tableAssignments[sectionId]) || p.tableId || null;

  const getPersonName = (p) =>
    (p.firstName || p.lastName)
      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
      : (p.name || "Unnamed");

  // ── 1. Separate already-seated from unseated ────────────────────────────────
  const unseated = scopedPeople.filter(p => !getPersonTableId(p));
  if (unseated.length === 0 || sortedTables.length === 0) {
    return { assignments: [], splits: [], unplaced: [], seatedCount: 0, unplacedCount: 0 };
  }

  // ── 2. Determine seating mode ───────────────────────────────────────────────
  // If any kids tables exist, route kids → kids/mixed tables, adults → adult/mixed tables.
  // If no kids tables, everyone goes to adult/mixed tables.
  const hasKidsTables = sortedTables.some(t => t.type === "kids");

  // ── 3. Build remaining capacity tracker ────────────────────────────────────
  // Pre-populate with current occupant counts (manually seated people not in unseated).
  const remaining = {};
  for (const t of sortedTables) {
    const occupants = scopedPeople.filter(p =>
      getPersonTableId(p) === t.id
    ).length;
    remaining[t.id] = Math.max(0, (parseInt(t.capacity) || 0) - occupants);
  }

  // Eligible tables by role
  const adultTables = sortedTables.filter(t => t.type === "adult" || t.type === "mixed");
  const kidsTables  = hasKidsTables
    ? sortedTables.filter(t => t.type === "kids"  || t.type === "mixed")
    : adultTables; // fallback: no kids tables → kids go with adults

  // ── 4. Group unseated by household ─────────────────────────────────────────
  const byHousehold = {};
  for (const p of unseated) {
    const hhId = p.householdId || "__none__";
    if (!byHousehold[hhId]) byHousehold[hhId] = [];
    byHousehold[hhId].push(p);
  }

  // Build placement units — each household produces up to 2 units:
  // one for adults, one for kids (or one combined if no kids tables)
  const placementUnits = []; // { hhId, hhName, people, tablePool, isKids }

  for (const [hhId, members] of Object.entries(byHousehold)) {
    const hh = householdMap[hhId];
    const hhName = hh ? (hh.name || hh.formalName || "Unknown household") : "Unknown household";

    // Apply attending override: cap the number of adults/kids from this household
    let adultMembers = members.filter(p => !p.isChild);
    let kidsMembers  = members.filter(p =>  p.isChild);

    if (hh) {
      const attending = getHouseholdAttending(hh, scopedPeople);
      // Cap to override if set — take first N by name for determinism
      if (hh.attendingAdults != null) {
        adultMembers = adultMembers
          .sort((a, b) => getPersonName(a).localeCompare(getPersonName(b)))
          .slice(0, attending.adults);
      }
      if (hh.attendingKids != null) {
        kidsMembers = kidsMembers
          .sort((a, b) => getPersonName(a).localeCompare(getPersonName(b)))
          .slice(0, attending.kids);
      }
    }

    if (hasKidsTables) {
      // Two separate placement units
      if (adultMembers.length > 0) {
        placementUnits.push({ hhId, hhName, people: adultMembers, tablePool: adultTables, isKids: false });
      }
      if (kidsMembers.length > 0) {
        placementUnits.push({ hhId, hhName, people: kidsMembers, tablePool: kidsTables, isKids: true });
      }
    } else {
      // One combined unit — everyone to adult/mixed tables
      const allMembers = [...adultMembers, ...kidsMembers];
      if (allMembers.length > 0) {
        placementUnits.push({ hhId, hhName, people: allMembers, tablePool: adultTables, isKids: false });
      }
    }
  }

  // ── 5. Sort: largest units first (First Fit Decreasing) ─────────────────────
  placementUnits.sort((a, b) => b.people.length - a.people.length);

  // ── 6. Greedy placement ─────────────────────────────────────────────────────
  const assignments = []; // { personId, tableId }
  const splitHouseholds = new Set(); // hhIds that were split
  const unplacedPeople = []; // { personName, householdName }

  // Track which tableId each placement unit's first member was placed at,
  // so we can detect splits within a unit
  const unitFirstTable = {}; // unitIndex → tableId of first placement

  for (let ui = 0; ui < placementUnits.length; ui++) {
    const unit = placementUnits[ui];
    let remaining_people = [...unit.people];
    let firstTableForUnit = null;
    let wasSplit = false;

    while (remaining_people.length > 0) {
      const groupSize = remaining_people.length;

      // Find first table that fits the whole remaining group
      const idealTable = unit.tablePool.find(
        t => remaining[t.id] >= groupSize
      );

      if (idealTable) {
        // Place everyone in this table
        for (const p of remaining_people) {
          assignments.push({ personId: p.id, tableId: idealTable.id });
          remaining[idealTable.id]--;
        }
        if (!firstTableForUnit) firstTableForUnit = idealTable.id;
        else if (firstTableForUnit !== idealTable.id) wasSplit = true;
        remaining_people = [];
      } else {
        // No table fits all — find the table with the most remaining space
        const bestTable = unit.tablePool
          .filter(t => remaining[t.id] > 0)
          .sort((a, b) => remaining[b.id] - remaining[a.id])[0];

        if (!bestTable) {
          // No space anywhere — all remaining are unplaced
          for (const p of remaining_people) {
            unplacedPeople.push({ personName: getPersonName(p), householdName: unit.hhName });
          }
          remaining_people = [];
        } else {
          const canPlace = remaining[bestTable.id];
          const toPlace  = remaining_people.slice(0, canPlace);
          const leftover = remaining_people.slice(canPlace);

          for (const p of toPlace) {
            assignments.push({ personId: p.id, tableId: bestTable.id });
            remaining[bestTable.id]--;
          }

          if (!firstTableForUnit) firstTableForUnit = bestTable.id;
          else wasSplit = true;

          remaining_people = leftover;
          wasSplit = true; // splitting by definition
        }
      }
    }

    if (wasSplit) splitHouseholds.add(unit.hhId);
  }

  // ── 7. Build splits summary ─────────────────────────────────────────────────
  const splits = [...splitHouseholds].map(hhId => {
    const hh = householdMap[hhId];
    return { householdName: hh ? (hh.name || hh.formalName || "Unknown") : "Unknown" };
  });

  return {
    assignments,
    splits,
    unplaced:     unplacedPeople,
    seatedCount:  assignments.length,
    unplacedCount: unplacedPeople.length,
  };
}
