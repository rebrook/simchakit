// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/_lib/team-auth.js
// Shared guard for the planning team's machine endpoints (digest-ingest, digest-decisions): one
// bearer key (DIGEST_INGEST_TOKEN), constant-time comparison, and a best-effort per-instance rate
// limit (same approach as notify.js). The key is never logged.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, timingSafeEqual } from "crypto";

const WINDOW_MS = 60_000;
const MAX_HITS  = 20;
const hits      = new Map();

function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  if (hits.size > 1000) hits.clear();
  hits.set(ip, list);
  return list.length > MAX_HITS;
}

const sha = (s) => createHash("sha256").update(String(s)).digest();

function tokenOk(req, expected) {
  const header = req.headers.authorization || "";
  const given  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return timingSafeEqual(sha(given), sha(expected));
}

// Returns true when the request may proceed. Otherwise it has already sent the response.
export function guardTeamRequest(req, res, label) {
  const expected = process.env.DIGEST_INGEST_TOKEN;
  if (!expected) {
    console.error(`[SimchaKit] ${label}: DIGEST_INGEST_TOKEN is not set.`);
    res.status(500).json({ error: "Server configuration error." });
    return false;
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) { res.status(429).json({ error: "Too many requests." }); return false; }
  if (!tokenOk(req, expected)) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}
