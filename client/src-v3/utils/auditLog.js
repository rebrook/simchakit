// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.17.2 — utils/auditLog.js
// Shared audit_log writer. Moved out of hooks/useEventData.js so any
// component (not just collection-backed tabs) can log an activity entry
// without a broken, non-schema-matching local writer of its own.
//
// audit_log table shape: { id, event_id, data, created_at, updated_at }
// The `data` jsonb column is always { action, detail, collection, actorId, actorName }.
// There are no top-level action/detail columns on this table -- writing to
// those directly (as GuestsTab.jsx's old local appendAuditLog did) fails
// silently at the database level and produces no audit entry at all.
//
// writeAuditLog(eventId, collection, action, itemOrDetail)
//   itemOrDetail as a STRING is used directly as the human-readable detail
//   text (e.g. "RSVP updated — Rosen Family: Invited → RSVP Yes").
//   itemOrDetail as an OBJECT (the shape useEventData's save/remove pass)
//   is run through AUDIT_LABELS[collection] to build the detail text, same
//   as before this file existed.
//
// Never blocks the caller and never throws -- failures are logged to the
// console and surfaced via the existing "simchakit:audit-error" event so
// AppShell can show its toast, same pattern as before.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase.js";

// ── Audit log detail labels per collection (used when itemOrDetail is an item, not a string) ──
export const AUDIT_LABELS = {
  households:    item => item.formalName || item.name || "a household",
  people:        item => [item.firstName, item.lastName].filter(Boolean).join(" ") || item.name || "a person",
  vendors:       item => item.name || "a vendor",
  expenses:      item => item.description || "an expense",
  tasks:         item => item.task || "a task",
  prep:          item => item.title || "a prep item",
  gifts:         item => item.fromName || "a gift",
  favors:        item => item.guestName || "a favor",
  tables:        item => item.name || "a table",
  ceremonyRoles: item => item.role || "a ceremony role",
};

// ── Fire-and-forget audit log writer ─────────────────────────────────────────
// Writes { action, detail, collection, actorId, actorName } into data jsonb.
// Actor comes from the cached Supabase session (no network call).
// If session is null (demo/anon/refresh race), the row is written un-attributed.
export async function writeAuditLog(eventId, collection, action, itemOrDetail) {
  try {
    let detail;
    if (typeof itemOrDetail === "string") {
      detail = itemOrDetail;
    } else {
      const labelFn = AUDIT_LABELS[collection] || (() => `a ${collection} item`);
      const label   = labelFn(itemOrDetail || {});
      const collectionLabel = collection.charAt(0).toUpperCase() + collection.slice(1);
      detail = `${action} ${label} in ${collectionLabel}`;
    }

    // Resolve actor from cached session — never blocks, never throws
    let actorId   = null;
    let actorName = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        actorId   = user.id;
        actorName = user.user_metadata?.display_name
                 || user.email?.split("@")[0]
                 || null;
      }
    } catch (_) { /* session unavailable — write un-attributed */ }

    const { error } = await supabase.from("audit_log").insert({
      event_id: eventId,
      data:     { action, detail, collection, actorId, actorName },
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[SimchaKit] Audit log write failed:", e.message);
    // Dispatch a custom event so AppShell can surface a user-facing toast
    window.dispatchEvent(new CustomEvent("simchakit:audit-error", { detail: e.message }));
  }
}
