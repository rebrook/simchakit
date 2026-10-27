// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.5.0 — hooks/useRsvpReplies.js
// An event's RSVP replies (guests answering from their private link), kept live.
// rsvp_replies is not a data-jsonb table like the others, so it has its own small
// hook instead of useEventData. Read access: owner, editors and viewers (RLS);
// coordinators and anyone not signed in get nothing, and the hook just reports an
// error and an empty list. Replies a newer reply replaced (superseded_at set) are
// ignored entirely: they are not pending and were never rejected by the host.
//
// Realtime is an enhancement (the table is added to the publication by V5.1-R3.sql):
// any change reloads the list, so a new reply appears without a refresh. If the
// channel never connects, the initial load and reload() still work.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase.js";

const COLUMNS = "id, event_id, household_id, submitted_at, status, payload, supersedes, superseded_at, applied_snapshot, reviewed_by, reviewed_at, reject_reason";

export function useRsvpReplies(eventId) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    const { data, error: err } = await supabase
      .from("rsvp_replies").select(COLUMNS)
      .eq("event_id", eventId).is("superseded_at", null)
      .order("submitted_at", { ascending: false }).limit(500);
    if (err) { setRows([]); setError(err.message); } else { setRows(data || []); setError(null); }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    if (!eventId) return undefined;
    const channel = supabase
      .channel(`db:rsvp_replies:${eventId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvp_replies", filter: `event_id=eq.${eventId}` }, () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(load, 250);   // collapse bursts into one reload
      })
      .subscribe();
    return () => { clearTimeout(timer.current); supabase.removeChannel(channel); };
  }, [eventId, load]);

  const pending = useMemo(() => rows.filter(r => r.status === "pending"), [rows]);
  // The latest accepted reply per household, to label a newer one "Updated reply".
  const acceptedByHousehold = useMemo(() => {
    const m = new Map();
    rows.filter(r => r.status === "accepted").forEach(r => {
      const cur = m.get(r.household_id);
      if (!cur || new Date(r.reviewed_at || r.submitted_at) > new Date(cur.reviewed_at || cur.submitted_at)) m.set(r.household_id, r);
    });
    return m;
  }, [rows]);

  return { replies: rows, pending, acceptedByHousehold, loading, error, reload: load };
}
