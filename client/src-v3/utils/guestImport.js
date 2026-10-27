// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.7.0 — utils/guestImport.js
// Applies a reviewed CSV import: saves the new households and people, fills
// blank fields on households the host chose to merge into, and optionally
// replaces the existing list first. Shared by the Guests tab and the Getting
// ready card so both write exactly the same way.
//
// payload: { households, people, merges: [{ existingId, fields }] } from ImportModal.
// ─────────────────────────────────────────────────────────────────────────────

import { writeAuditLog } from "@/utils/auditLog.js";

export async function applyGuestImport({
  eventId, payload, mode,
  households, people,
  saveHouseholdRow, savePersonRow, removeHouseholdRow, removePersonRow,
}) {
  const { households: newHH, people: newPpl, merges = [] } = payload;

  if (mode === "replace") {
    for (const h of households) await removeHouseholdRow(h._rowId);
    for (const p of people)     await removePersonRow(p._rowId);
  }
  for (const h of newHH)  await saveHouseholdRow(h);
  for (const p of newPpl) await savePersonRow(p);
  for (const m of merges) {
    const existing = households.find(h => h.id === m.existingId);
    if (existing) await saveHouseholdRow({ ...existing, ...m.fields });
  }

  const mergeNote = merges.length ? `, merged ${merges.length} into existing households` : "";
  writeAuditLog(
    eventId, "households", "Added",
    `Imported ${newHH.length} household${newHH.length !== 1 ? "s" : ""} and ${newPpl.length} guest${newPpl.length !== 1 ? "s" : ""} (${mode === "replace" ? "replaced existing list" : "added to existing list"}${mergeNote})`
  );
  return { households: newHH.length, people: newPpl.length, merged: merges.length };
}
