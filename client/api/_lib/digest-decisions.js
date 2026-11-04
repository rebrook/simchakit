// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/_lib/digest-decisions.js
// GET  /api/admin?action=digest-decisions[&weeks=1..12]  Authorization: Bearer <DIGEST_INGEST_TOKEN>
//      Recent digests with the owner's answers: the latest decision per item, how many earlier
//      ones there were, and which are not picked up yet (picked_up_at is null).
// POST /api/admin?action=digest-decisions  {id, team_status?, team_reply?, picked_up?}
//      The team records that it picked an answer up, where the work stands, and its reply to a
//      question. Writes only those three columns on one decision row.
// Machine caller only. Nothing in the body can change the owner's decision, reason or answers.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { guardTeamRequest } from "./team-auth.js";

const STATUSES = ["picked_up", "in_progress", "needs_input", "ready_to_ship", "done", "declined"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!guardTeamRequest(req, res, "digest-decisions")) return;

  if (req.method === "POST") {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b) || !UUID.test(String(b.id || ""))) {
      return res.status(400).json({ error: "id must be a decision id." });
    }
    const patch = {};
    if (b.team_status !== undefined) {
      if (!STATUSES.includes(b.team_status)) return res.status(400).json({ error: "Unknown team_status." });
      patch.team_status = b.team_status;
    }
    if (b.team_reply !== undefined) patch.team_reply = String(b.team_reply).slice(0, 2000);
    if (b.picked_up === true) patch.picked_up_at = new Date().toISOString();
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update." });

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from("agent_decisions").update(patch).eq("id", b.id).select("id");
    if (error) {
      console.error("[SimchaKit] digest-decisions: update failed:", error.code || "unknown");
      return res.status(500).json({ error: "Could not update the decision." });
    }
    if (!data?.length) return res.status(404).json({ error: "No such decision." });
    return res.status(200).json({ updated: true });
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const weeks = Math.min(12, Math.max(1, parseInt(req.query?.weeks, 10) || 4));
  const { data: digests, error } = await supabase
    .from("agent_digests")
    .select("id, week_of, fact_checked, payload")
    .order("week_of", { ascending: false })
    .limit(weeks);
  if (error) {
    console.error("[SimchaKit] digest-decisions: read failed:", error.code || "unknown");
    return res.status(500).json({ error: "Could not read digests." });
  }

  let rows = [];
  if (digests.length) {
    const r = await supabase
      .from("agent_decisions")
      .select("id, digest_id, item_no, title, decision, reason, answers, decided_at, team_status, team_reply, picked_up_at")
      .in("digest_id", digests.map((d) => d.id))
      .order("decided_at", { ascending: false });
    if (r.error) {
      console.error("[SimchaKit] digest-decisions: read failed:", r.error.code || "unknown");
      return res.status(500).json({ error: "Could not read decisions." });
    }
    rows = r.data;
  }

  const out = digests.map((d) => {
    const mine = rows.filter((r) => r.digest_id === d.id);
    const seen = new Map();
    for (const r of mine) {
      const e = seen.get(r.item_no);
      if (e) e.earlier += 1; else seen.set(r.item_no, { ...r, earlier: 0 });
    }
    return {
      week_of: d.week_of,
      fact_checked: d.fact_checked,
      payload: d.payload,
      decisions: [...seen.values()].sort((a, b) => a.item_no - b.item_no).map(({ digest_id, ...rest }) => rest),
    };
  });
  return res.status(200).json({ digests: out });
}
