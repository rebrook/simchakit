// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.0.0 — useEventData.js
// Core data hook. Provides fetch-on-mount, optimistic save, and delete
// for any collection table in Supabase.
//
// Usage:
//   const { items, loading, error, save, remove, reload } = useEventData(eventId, "tasks")
//
// Each item is the row's `data` jsonb merged with a `_rowId` field (the UUID PK).
// Save: if item has _rowId → upsert that row. If not → insert new row.
// Remove: deletes by _rowId.
//
// Special case — households: pass promoteColumns to extract indexed columns
// from the item and write them alongside `data`.
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
async function writeAuditLog(eventId, collection, action, item) {
  try {
    const labelFn = AUDIT_LABELS[collection] || (() => `a ${collection} item`);
    const label   = labelFn(item || {});
    const collectionLabel = collection.charAt(0).toUpperCase() + collection.slice(1);
    const detail  = `${action} ${label} in ${collectionLabel}`;
    const { error } = await supabase.from("audit_log").insert({
      event_id:   eventId,
      data:       { action, detail },
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

  // ── Save (upsert) ─────────────────────────────────────────────────────────────
  const save = useCallback(async (item) => {
    if (!eventId) return { error: "No event ID" };

    // Strip internal tracking fields before storing in data jsonb
    const { _rowId, _createdAt, _updatedAt, ...dataPayload } = item;

    const promoted = promoteRef.current(item);
    const isNew    = !_rowId;

    const row = {
      ...(isNew ? {} : { id: _rowId }),
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

    // Optimistic update — replace existing or append new
    setItems(prev =>
      isNew
        ? [...prev, savedItem]
        : prev.map(i => i._rowId === _rowId ? savedItem : i)
    );

    // Fire-and-forget audit log — never blocks the save
    writeAuditLog(eventId, collectionRef.current, isNew ? "Added" : "Updated", dataPayload);

    return { item: savedItem };
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
