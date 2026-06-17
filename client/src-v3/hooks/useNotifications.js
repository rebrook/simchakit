// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.11.0 — useNotifications.js
// Per-user notification layer over the global audit_log.
//
// Provides:
//   unreadCount   — number of unread audit_log entries (excluding self)
//   entries       — most recent 50 entries for the panel (with isUnread flag)
//   loading       — true while initial fetch is in progress
//   markAllRead   — advances the per-user cursor (non-destructive)
//   refreshCount  — manually re-fetch count (called on tab-change)
//
// Reliable path: visibilitychange refetch + tab-change refetch.
// Enhancement:   Supabase Realtime subscription on audit_log INSERTs
//                (requires audit_log in supabase_realtime publication).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase.js";

// ── Collection → tab mapping for deep-links ──────────────────────────────────
const COLLECTION_TAB = {
  households:    "guests",
  people:        "guests",
  expenses:      "budget",
  vendors:       "vendors",
  tasks:         "tasks",
  prep:          "prep",
  ceremonyRoles: "ceremony",
  tables:        "seating",
  seating:       "seating",
  gifts:         "gifts",
  favors:        "favors",
};

export function useNotifications(eventId, session) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(true);

  const cursorRef   = useRef(null);   // last_seen_at ISO string
  const myIdRef     = useRef(null);
  const channelRef  = useRef(null);
  const mountedRef  = useRef(true);
  // Track fetched entry IDs to prevent Realtime duplicates
  const entryIdsRef = useRef(new Set());

  const myId = session?.user?.id || null;
  myIdRef.current = myId;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Map a raw audit_log row to a panel entry
  function toEntry(row, cursor) {
    const d = row.data || {};
    return {
      id:         row.id,
      action:     d.action || "Updated",
      detail:     d.detail || "",
      collection: d.collection || null,
      actorId:    d.actorId || null,
      actorName:  d.actorName || null,
      createdAt:  row.created_at,
      tab:        COLLECTION_TAB[d.collection] || null,
      isUnread:   cursor ? row.created_at > cursor : false,
    };
  }

  // ── Init cursor + load entries ──────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!eventId || !myId) {
      setLoading(false);
      return;
    }

    // 1. Fetch or create the per-user read cursor (idempotent upsert)
    let cursor = null;
    try {
      const { data: readRow } = await supabase
        .from("notification_reads")
        .select("last_seen_at")
        .eq("user_id", myId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (readRow) {
        cursor = readRow.last_seen_at;
      } else {
        // First time: insert cursor at now() so user starts with 0 unread
        const now = new Date().toISOString();
        await supabase.from("notification_reads").upsert(
          { user_id: myId, event_id: eventId, last_seen_at: now },
          { onConflict: "user_id,event_id" }
        );
        cursor = now;
      }
    } catch (e) {
      console.error("[SimchaKit] notification_reads fetch failed:", e.message);
      // Fall through with null cursor — treat everything as read
    }

    cursorRef.current = cursor;

    // 2. Fetch unread count — all rows after cursor, filter self client-side
    const countResult = await fetchUnreadCount(eventId, cursor, myId);
    if (mountedRef.current) setUnreadCount(countResult);

    // 3. Fetch recent entries for panel display (capped at 50)
    try {
      const { data: rows } = await supabase
        .from("audit_log")
        .select("id, data, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (mountedRef.current && rows) {
        const mapped = rows.map(r => toEntry(r, cursor));
        setEntries(mapped);
        entryIdsRef.current = new Set(rows.map(r => r.id));
      }
    } catch (e) {
      console.error("[SimchaKit] notification entries fetch failed:", e.message);
    }

    if (mountedRef.current) setLoading(false);
  }, [eventId, myId]);

  // ── Standalone count fetch (used by focus-refetch + tab-change) ─────────
  const refreshCount = useCallback(async () => {
    if (!eventId || !myId || !cursorRef.current) return;
    const count = await fetchUnreadCount(eventId, cursorRef.current, myId);
    if (mountedRef.current) setUnreadCount(count);
  }, [eventId, myId]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    loadAll();
    return () => { mountedRef.current = false; };
  }, [loadAll]);

  // ── Focus-refetch: re-run count against existing cursor ────────────────────
  // Does NOT advance the cursor — only "Mark all read" does that.
  useEffect(() => {
    if (!eventId || !myId) return;
    let debounceTimer = null;
    const handler = () => {
      if (document.visibilityState === "visible") {
        // Debounce to avoid rapid re-fetches on fast tab switches
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          refreshCount();
        }, 500);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      clearTimeout(debounceTimer);
    };
  }, [eventId, myId, refreshCount]);

  // ── Realtime enhancement: subscribe to audit_log INSERTs ──────────────────
  // If audit_log is not in supabase_realtime publication, this silently no-ops.
  useEffect(() => {
    if (!eventId || !myId) return;

    const channel = supabase
      .channel(`notifications:${eventId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "audit_log",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!mountedRef.current) return;
          const row = payload.new;
          if (!row) return;

          const d = row.data || {};

          // Self-exclude: ignore own actions
          if (d.actorId === myIdRef.current) return;

          // Dedupe: skip if we already have this entry
          if (entryIdsRef.current.has(row.id)) return;

          // Add to entries and increment count (single source of truth)
          const entry = toEntry(row, cursorRef.current);
          entryIdsRef.current.add(row.id);
          setEntries(prev => [entry, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [eventId, myId]);

  // ── Mark all read ──────────────────────────────────────────────────────────
  // Optimistic: set count to 0 immediately, then upsert the cursor.
  // Per-user, non-destructive — does NOT touch audit_log rows.
  const markAllRead = useCallback(async () => {
    if (!eventId || !myId) return;

    const now = new Date().toISOString();

    // Optimistic update
    setUnreadCount(0);
    setEntries(prev => prev.map(e => ({ ...e, isUnread: false })));
    cursorRef.current = now;

    try {
      await supabase.from("notification_reads").upsert(
        { user_id: myId, event_id: eventId, last_seen_at: now },
        { onConflict: "user_id,event_id" }
      );
    } catch (e) {
      console.error("[SimchaKit] markAllRead failed:", e.message);
      // Reconcile: re-fetch the actual count
      refreshCount();
    }
  }, [eventId, myId, refreshCount]);

  return { unreadCount, entries, loading, markAllRead, refreshCount };
}

// ── Fetch unread count (standalone, no head:true — filter actorId client-side)
async function fetchUnreadCount(eventId, cursor, myId) {
  if (!cursor) return 0;
  try {
    const { data: rows } = await supabase
      .from("audit_log")
      .select("id, data")
      .eq("event_id", eventId)
      .gt("created_at", cursor);

    if (!rows) return 0;
    // Exclude own actions; legacy null-actorId rows count as not-yours
    return rows.filter(r => (r.data?.actorId || null) !== myId).length;
  } catch (e) {
    console.error("[SimchaKit] fetchUnreadCount failed:", e.message);
    return 0;
  }
}
