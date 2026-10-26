// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — hooks/useMessageLog.js
// Loads an event's message_log and message_recipients (RLS: owner, editors and
// viewers can read) and exposes them flattened for buildSentLookup and the
// Messages view. If the read fails (for example V5.0-M2.sql has not been run, so
// the channel column is missing) it returns an error and empty data, and the
// Guests tab falls back to the pre-V5 flags instead of breaking.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase.js";
import { buildSentLookup } from "@/utils/messageStatus.js";

const PAGE = 1000;   // PostgREST's default max rows per request

async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export function useMessageLog(eventId) {
  const [logs,       setLogs]       = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const logRows = await fetchAll(() => supabase
        .from("message_log")
        .select("id, kind, channel, subject, body_snapshot, sent_by, sent_at, recipient_count")
        .eq("event_id", eventId)
        .order("sent_at", { ascending: false }));
      const recipRows = await fetchAll(() => supabase
        .from("message_recipients")
        .select("message_id, household_id, email, status, error, message_log!inner(event_id)")
        .eq("message_log.event_id", eventId)
        .order("message_id"));
      const byId = new Map(logRows.map(l => [l.id, l]));
      setLogs(logRows);
      setRecipients(recipRows
        .filter(r => byId.has(r.message_id))
        .map(r => {
          const log = byId.get(r.message_id);
          return {
            messageId:   r.message_id,
            householdId: r.household_id,
            email:       r.email,
            status:      r.status,
            error:       r.error,
            kind:        log.kind,
            channel:     log.channel,
            sentAt:      log.sent_at,
            loggedAt:    log.sent_at,
          };
        }));
      setError(null);
    } catch (err) {
      console.warn("[SimchaKit] message log unavailable:", err.message);
      setLogs([]); setRecipients([]); setError(err.message);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const sentLookup = useMemo(() => buildSentLookup(recipients), [recipients]);

  return { logs, recipients, loading, error, reload: load, sentLookup };
}
