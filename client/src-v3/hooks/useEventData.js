// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.17.0 — useEventData.js
// Core data hook. Provides fetch-on-mount, optimistic save, and delete
// for any collection table in Supabase.
//
// Usage:
//   const { items, loading, error, save, remove, reload } = useEventData(eventId, "tasks")
//
// Each item is the row's `data` jsonb merged with a `_rowId` field (the UUID PK).
// Save: if item has _rowId → conditional update via the save_row RPC (see below).
//       If not → insert new row via upsert (unchanged from before).
// Remove: deletes by _rowId.
//
// Special case — households: pass promoteColumns to extract indexed columns
// from the item and write them alongside `data`.
//
// ── Concurrency (V4.17.0) ──────────────────────────────────────────────────
// Existing rows are saved through the save_row() Postgres RPC instead of a
// plain upsert. The RPC only applies the write if the row's updated_at still
// matches what this client last fetched (item._updatedAt). If another
// co-planner saved the same row in between, the write is rejected instead of
// silently overwriting their change, and save() returns the current server
// copy so the caller can inform the user and refresh the UI. See:
//   migrations/2026-07-20_save_row_optimistic_concurrency.sql
//
// save() return shapes:
//   Success:            { item: savedItem }
//   Conflict (updated):  { conflict: true, serverItem }
//   Conflict (deleted):  { conflict: true, serverItem: null, deleted: true }
//   Error:              { error: message }
//
// On any conflict, this hook also dispatches a "simchakit:save-conflict"
// CustomEvent (detail: { collection, serverItem, deleted }) on window, mirroring
// the existing "simchakit:audit-error" pattern, so AppShell can show a toast
// without every tab needing its own conflict-handling code. Tabs that want
// more specific behavior (e.g. re-opening an edit form with the server copy)
// can still use the { conflict, serverItem } return value directly.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase.js";

// ── Audit log detail labels per collection ────────────────────────────────────
const AUDIT_LABELS = {
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
async function writeAuditLog(eventId, collection, action, item) {
  try {
    const labelFn = AUDIT_LABELS[collection] || (() => `a ${collection} item`);
    const label   = labelFn(item || {});
    const collectionLabel = collection.charAt(0).toUpperCase() + collection.slice(1);
    const detail  = `${action} ${label} in ${collectionLabel}`;

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

// ── Default promoter — no promoted columns ────────────────────────────────────
function noPromote(_item) { return {}; }

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useEventData(eventId, collection, options = {}) {
  const {
    promoteColumns = noPromote,  // (item) => { col: value, ... } for indexed columns
    orderBy        = "created_at", // column to order by
    ascending      = true,
  } = options;

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Prevent stale-closure issues on reload
  const collectionRef    = useRef(collection);
  const eventIdRef       = useRef(eventId);
  const promoteRef       = useRef(promoteColumns);
  collectionRef.current  = collection;
  eventIdRef.current     = eventId;
  promoteRef.current     = promoteColumns;

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!eventId || !collection) return;
    setLoading(true);
    setError(null);

    const { data: rows, error: fetchError } = await supabase
      .from(collection)
      .select("id, data, created_at, updated_at")
      .eq("event_id", eventId)
      .order(orderBy, { ascending });

    if (fetchError) {
      console.error(`[SimchaKit] useEventData fetch error (${collection}):`, fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // Merge _rowId into each item for upsert/delete identification
    const mapped = (rows || []).map(row => ({
      ...(row.data || {}),
      _rowId:     row.id,
      _createdAt: row.created_at,
      _updatedAt: row.updated_at,
    }));

    setItems(mapped);
    setLoading(false);
  }, [eventId, collection, orderBy, ascending]);

  // Fetch on mount
  useEffect(() => { load(); }, [load]);

  // ── Save (insert new, or conditionally update existing) ───────────────────────
  const save = useCallback(async (item) => {
    if (!eventId) return { error: "No event ID" };

    // Strip internal tracking fields before storing in data jsonb
    const { _rowId, _createdAt, _updatedAt, ...dataPayload } = item;

    const promoted = promoteRef.current(item);
    const isNew    = !_rowId;

    // ── New row: unchanged insert-via-upsert path ────────────────────────────
    if (isNew) {
      const row = {
        event_id:   eventId,
        data:       dataPayload,
        updated_at: new Date().toISOString(),
        ...promoted,
      };

      const { data: saved, error: saveError } = await supabase
        .from(collectionRef.current)
        .upsert(row, { onConflict: "id" })
        .select("id, data, created_at, updated_at")
        .single();

      if (saveError) {
        console.error(`[SimchaKit] useEventData save error (${collectionRef.current}):`, saveError.message);
        return { error: saveError.message };
      }

      const savedItem = {
        ...(saved.data || {}),
        _rowId:     saved.id,
        _createdAt: saved.created_at,
        _updatedAt: saved.updated_at,
      };

      setItems(prev => [...prev, savedItem]);

      // Fire-and-forget audit log — never blocks the save
      writeAuditLog(eventId, collectionRef.current, "Added", dataPayload);

      return { item: savedItem };
    }

    // ── Existing row: conditional update via save_row RPC ───────────────────
    // Only applies the write if updated_at still matches what this client
    // last fetched. Rejects (rather than overwrites) if another co-planner
    // saved the same row in between.
    const { data: rpcResult, error: rpcError } = await supabase.rpc("save_row", {
      p_table:               collectionRef.current,
      p_id:                  _rowId,
      p_event_id:            eventId,
      p_data:                dataPayload,
      p_expected_updated_at: _updatedAt,
      p_promoted:            promoted,
    });

    if (rpcError) {
      console.error(`[SimchaKit] useEventData save error (${collectionRef.current}):`, rpcError.message);
      return { error: rpcError.message };
    }

    if (rpcResult.status === "ok") {
      const savedItem = {
        ...(rpcResult.row.data || {}),
        _rowId:     rpcResult.row.id,
        _createdAt: rpcResult.row.created_at,
        _updatedAt: rpcResult.row.updated_at,
      };

      setItems(prev => prev.map(i => i._rowId === _rowId ? savedItem : i));

      // Fire-and-forget audit log — only on a successful save, never on conflict
      writeAuditLog(eventId, collectionRef.current, "Updated", dataPayload);

      return { item: savedItem };
    }

    if (rpcResult.status === "deleted") {
      // Row was deleted by someone else while this client had it open
      setItems(prev => prev.filter(i => i._rowId !== _rowId));

      window.dispatchEvent(new CustomEvent("simchakit:save-conflict", {
        detail: { collection: collectionRef.current, serverItem: null, deleted: true },
      }));

      return { conflict: true, serverItem: null, deleted: true };
    }

    // rpcResult.status === "conflict": someone else's save landed first.
    // Replace the local copy with the current server copy so the UI reflects
    // reality even before the calling tab reacts to the conflict.
    const serverItem = {
      ...(rpcResult.row.data || {}),
      _rowId:     rpcResult.row.id,
      _createdAt: rpcResult.row.created_at,
      _updatedAt: rpcResult.row.updated_at,
    };

    setItems(prev => prev.map(i => i._rowId === _rowId ? serverItem : i));

    window.dispatchEvent(new CustomEvent("simchakit:save-conflict", {
      detail: { collection: collectionRef.current, serverItem, deleted: false },
    }));

    return { conflict: true, serverItem };
  }, [eventId]);

  // ── Remove (delete) ───────────────────────────────────────────────────────────
  const remove = useCallback(async (rowId) => {
    if (!rowId) return { error: "No row ID" };

    const { error: deleteError } = await supabase
      .from(collectionRef.current)
      .delete()
      .eq("id", rowId)
      .eq("event_id", eventIdRef.current);

    if (deleteError) {
      console.error(`[SimchaKit] useEventData delete error (${collectionRef.current}):`, deleteError.message);
      return { error: deleteError.message };
    }

    setItems(prev => prev.filter(i => i._rowId !== rowId));

    // Fire-and-forget audit log — never blocks the delete
    const deletedItem = items.find(i => i._rowId === rowId) || {};
    writeAuditLog(eventIdRef.current, collectionRef.current, "Deleted", deletedItem);

    return { ok: true };
  }, [items]);

  // ── Reload ─────────────────────────────────────────────────────────────────
  const reload = useCallback(() => load(), [load]);

  return { items, loading, error, save, remove, reload, setItems };
}

// ── Convenience: households promoted columns ───────────────────────────────────
export function householdPromoteColumns(item) {
  return {
    status:       item.rsvpStatus || "Invited",
    group_name:   item.group      || "",
    out_of_town:  item.outOfTown  || false,
  };
}

// ── Convenience: people promoted columns ──────────────────────────────────────
// household_id column removed — householdId lives in data jsonb
export function peoplePromoteColumns(_item) {
  return {};
}
