// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — hooks/useBriefing.js
// Reads agent_digests and agent_decisions through the signed-in session (RLS: admin_users only) and
// records Approve / Reject / Not now / Question as new rows, so a changed mind is kept as history.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase.js";

const WEEKS = 12;

export function useBriefing() {
  const [digests,   setDigests]   = useState([]);
  const [decisions, setDecisions] = useState([]);   // newest first
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const load = useCallback(async () => {
    const { data: d, error: dErr } = await supabase
      .from("agent_digests")
      .select("id, week_of, created_at, fact_checked, payload")
      .order("week_of", { ascending: false })
      .limit(WEEKS);
    if (dErr) { setError(dErr.message); setLoading(false); return; }
    let rows = [];
    if (d.length) {
      const { data: r, error: rErr } = await supabase
        .from("agent_decisions")
        .select("id, digest_id, item_no, title, decision, reason, answers, decided_at, team_status, team_reply")
        .in("digest_id", d.map(x => x.id))
        .order("decided_at", { ascending: false });
      if (rErr) { setError(rErr.message); setLoading(false); return; }
      rows = r;
    }
    setDigests(d);
    setDecisions(rows);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Latest decision per digest item, plus the full history per item.
  const byItem = useMemo(() => {
    const map = new Map();
    for (const r of decisions) {
      const k = `${r.digest_id}:${r.item_no}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return map;
  }, [decisions]);

  const historyFor = (digestId, itemNo) => byItem.get(`${digestId}:${itemNo}`) || [];

  const latest = digests[0] || null;
  // Needs you: no answer yet, or you asked a question and the team has replied.
  const undecided = latest
    ? (Array.isArray(latest.payload?.decisions) ? latest.payload.decisions : [])
        .filter(it => {
          const cur = historyFor(latest.id, it.item_no)[0];
          return !cur || (cur.decision === "question" && cur.team_reply);
        }).length
    : 0;

  // Returns an error message, or "" when saved.
  async function decide(digest, item, decision, reason, answers) {
    const { error: iErr } = await supabase.from("agent_decisions").insert({
      digest_id: digest.id,
      item_no:   item.item_no,
      title:     String(item.title || "").slice(0, 200),
      decision,
      reason:    reason.trim() ? reason.trim().slice(0, 1000) : null,
      answers:   answers && Object.keys(answers).length ? answers : null,
    });
    if (iErr) return iErr.message;
    await load();
    return "";
  }

  return { digests, loading, error, undecided, historyFor, decide };
}
