// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/_lib/digest-ingest.js
// POST /api/admin?action=digest-ingest with Authorization: Bearer <DIGEST_INGEST_TOKEN>
// Machine caller only (the weekly routine or scripts/send-digest.sh): a user token is not accepted. Stores one weekly digest
// for the admin console's Weekly briefing screen. Upserts by week_of. The stored payload is rebuilt
// from known fields only, every text field is clipped, and nothing in the body can set decision
// fields (those are written only from the signed-in admin's browser). Neither the token nor the
// payload is ever logged.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { guardTeamRequest } from "./team-auth.js";

const MAX_BYTES = 100_000;

const txt  = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

const httpsUrl = (v, max) => {
  const u = txt(v, max);
  return /^https:\/\//i.test(u) ? u : "";
};

// What a decision looks like once it is done: a finished post, or a before/after of a screen.
function cleanMockup(m) {
  const kind = oneOf(m?.kind, ["post", "screen"], "");
  if (!kind) return null;
  return {
    kind,
    heading:          txt(m.heading, 120),
    text:             txt(m.text, 3000),
    image_url:        httpsUrl(m.image_url, 500),
    image_alt:        txt(m.image_alt, 300),
    when:             txt(m.when, 120),
    where:            txt(m.where, 200),
    before:           txt(m.before, 800),
    after:            txt(m.after, 800),
    before_image_url: httpsUrl(m.before_image_url, 500),
    after_image_url:  httpsUrl(m.after_image_url, 500),
  };
}

function cleanPayload(body) {
  const link = txt(body.link, 500);
  return {
    numbers: list(body.numbers, 8).map((n) => ({
      label: txt(n?.label, 60),
      value: txt(n?.value, 40),
      note:  txt(n?.note, 120),
    })),
    decisions: list(body.decisions, 20).map((d, i) => ({
      item_no:        i + 1,
      title:          txt(d?.title, 200),
      recommendation: txt(d?.recommendation, 600),
      confidence:     txt(d?.confidence, 40),
      effort:         txt(d?.effort, 80),
      why:            txt(d?.why, 1500),
      could_be_wrong: txt(d?.could_be_wrong, 1000),
      mockup:         cleanMockup(d?.mockup),
      asks: list(d?.asks, 5).map((a, k) => ({
        id:         `a${k + 1}`,
        label:      txt(a?.label, 200),
        why:        txt(a?.why, 400),
        example:    txt(a?.example, 200),
        skip_means: txt(a?.skip_means, 300),
      })),
      checks: list(d?.checks, 12).map((c) => ({
        claim:  txt(c?.claim, 300),
        status: oneOf(c?.status, ["checked", "unverified"], "unverified"),
      })),
    })),
    ship: list(body.ship, 6).map((c) => ({
      title: txt(c?.title, 200),
      steps: list(c?.steps, 20).map((st) => ({ text: txt(st?.text, 400), code: txt(st?.code, 1200) })),
    })),
    held_back: list(body.held_back, 20).map((h) => txt(h, 300)),
    usage: txt(body.usage, 300),
    link:  /^https:\/\//i.test(link) ? link : "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!guardTeamRequest(req, res, "digest-ingest")) return;

  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BYTES) return res.status(413).json({ error: "Payload too large." });

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Body must be a JSON object." });
  }
  if (JSON.stringify(body).length > MAX_BYTES) return res.status(413).json({ error: "Payload too large." });

  const weekOf = typeof body.week_of === "string" ? body.week_of : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf) || Number.isNaN(Date.parse(`${weekOf}T00:00:00Z`))) {
    return res.status(400).json({ error: "week_of must be a date like 2026-11-03." });
  }
  if (!Array.isArray(body.decisions)) {
    return res.status(400).json({ error: "decisions must be a list." });
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("agent_digests").upsert(
    { week_of: weekOf, fact_checked: body.fact_checked === true, payload: cleanPayload(body) },
    { onConflict: "week_of" }
  );
  if (error) {
    console.error("[SimchaKit] digest-ingest: store failed:", error.code || "unknown");
    return res.status(500).json({ error: "Could not store the digest." });
  }
  return res.status(200).json({ stored: true, week_of: weekOf });
}
