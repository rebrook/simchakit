// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.17.4 — useEventData.js
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
// ── rsvpStatus canonicalization (V4.17.4) ───────────────────────────────────
// Households previously forked on two field names: GuestsTab's pill/bulk/modal
// writers used `status`, while this file's householdPromoteColumns and
// utils/focus.js's Overview panel read `rsvpStatus`. All writers now use
// `rsvpStatus` (see HouseholdItem typedef below). load() also runs a lazy,
// additive self-heal for any household still missing `rsvpStatus`, backing it
// off the legacy `status` key. See migrations/2026-07-22_backfill_rsvp_status.sql
// for the bulk one-time fix this mirrors.
//
// ── Audit logging (V4.17.2) ─────────────────────────────────────────────────
// writeAuditLog now lives in utils/auditLog.js so any component can log an
// activity entry, not just this hook. Imported here rather than defined
// locally; behavior for save()/remove() is unchanged.
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
import { writeAuditLog } from "@/utils/auditLog.js";

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

    // ── Legacy rsvpStatus self-heal (households only, V4.17.4) ─────────────
    // Rows saved before the rsvpStatus rename may still have RSVP state only
    // under the legacy `status` key inside data jsonb. The bulk SQL migration
    // (migrations/2026-07-22_backfill_rsvp_status.sql) is the primary fix;
    // this is a lazy safety net for any row that slips through (e.g. an
    // offline client writing a stale cached copy between migration and
    // deploy). Runs after setItems so the UI is never blocked on it. Additive
    // only — never deletes the legacy `status` key, mirroring the migration.
    if (collection === "households") {
      const legacyRows = mapped.filter(h => h.rsvpStatus == null && h.status != null);
      legacyRows.forEach(async (h) => {
        const { _rowId, _createdAt, _updatedAt, ...dataPayload } = h;
        const fixedData = { ...dataPayload, rsvpStatus: dataPayload.status };
        const promoted  = householdPromoteColumns(fixedData);

        const { data: rpcResult, error: rpcError } = await supabase.rpc("save_row", {
          p_table:               "households",
          p_id:                  _rowId,
          p_event_id:            eventId,
          p_data:                fixedData,
          p_expected_updated_at: _updatedAt,
          p_promoted:            promoted,
        });

        if (rpcError) {
          console.warn(`[SimchaKit] rsvpStatus self-heal skipped for ${_rowId}:`, rpcError.message);
          return;
        }
        if (rpcResult.status === "ok") {
          const healed = {
            ...(rpcResult.row.data || {}),
            _rowId:     rpcResult.row.id,
            _createdAt: rpcResult.row.created_at,
            _updatedAt: rpcResult.row.updated_at,
          };
          setItems(prev => prev.map(i => i._rowId === _rowId ? healed : i));
        }
        // "conflict" or "deleted": someone else changed the row first, or it's
        // gone. Leave it alone — the next load() will re-evaluate from scratch.
      });
    }
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
/**
 * @typedef {Object} HouseholdItem
 * @property {string}  _rowId       - Supabase row UUID (internal, stripped before save).
 * @property {string}  rsvpStatus   - CANONICAL field for RSVP state. One of
 *   "Invited" | "RSVP Yes" | "RSVP No" | "Pending" | "Maybe". Defaults to
 *   "Invited" when absent. This is the ONLY field name that should ever be
 *   read or written for RSVP state — do not reintroduce a sibling `status`
 *   field for this purpose. (Legacy rows saved before V4.17.4 may still carry
 *   a `status` key in the jsonb `data` column; it is inert and kept only for
 *   rollback safety. See migrations/2026-07-22_backfill_rsvp_status.sql.)
 * @property {string}  [group]      - Household group/category label.
 * @property {boolean} [outOfTown]  - Whether the household is traveling in.
 *
 * The Postgres `status` COLUMN on the households table (see
 * householdPromoteColumns below) is a different thing entirely: it is a
 * promoted, indexed copy of `rsvpStatus`, not the source of truth. Never
 * write to it directly — it is derived every save from `item.rsvpStatus`.
 */
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
