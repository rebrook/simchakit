#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5-P0 — scripts/check-endpoints.mjs
// Calls every public API URL on two deployments and compares HTTP status and
// top-level response keys. Every request is safe: no credentials are sent, so
// the destructive endpoints (demo reset, cron, admin, send) answer 401/400 and
// nothing is changed or emailed.
//
// Usage:
//   node scripts/check-endpoints.mjs <old-base-url> <new-base-url> [--bypass <secret>]
// --bypass is the Vercel "Protection Bypass for Automation" secret, needed
// because preview deployments are behind Vercel login by default.
// Exit code 0 = identical, 1 = differences, 2 = bad usage.
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const bypassAt = args.indexOf("--bypass");
const bypass = bypassAt >= 0 ? args.splice(bypassAt, 2)[1] : null;
const [oldBase, newBase] = args.map(u => u?.replace(/\/+$/, ""));
if (!oldBase || !newBase) {
  console.error("Usage: node scripts/check-endpoints.mjs <old-base-url> <new-base-url> [--bypass <secret>]");
  process.exit(2);
}

const JSON_HEADERS = { "content-type": "application/json" };
const post = (path, body = {}) => ({ path, method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
const get  = path => ({ path, method: "GET" });

const CHECKS = [
  post("/api/accept-invite", { token: "not-a-real-token" }),
  post("/api/send-invite", {}),
  post("/api/create-checkout-session", {}),
  post("/api/validate-coupon", {}),
  post("/api/calendar/generate-token", {}),
  // The feed behind webcal://app.simcha-kit.com/api/calendar/subscribe?token=...
  // (webcal:// is just https:// with the calendar app's own scheme).
  get("/api/calendar/subscribe?token=not-a-real-token"),
  get("/api/calendar/subscribe"),
  post("/api/admin-query", {}),
  get("/api/reset-demo"),
  post("/api/notify", {}),
  post("/api/brevo-sync", {}),
  post("/api/stripe-webhook", {}),          // unsigned: both must reject the same way
  get("/api/cron/lifecycle-emails"),        // no CRON_SECRET: both must answer 401
];

async function hit(base, c) {
  const headers = { ...(c.headers || {}), ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}) };
  try {
    const res = await fetch(base + c.path, { method: c.method, headers, body: c.body, redirect: "manual" });
    const type = res.headers.get("content-type") || "";
    const text = await res.text();
    let shape;
    if (type.includes("json")) {
      try { const j = JSON.parse(text); shape = "json:" + (j && typeof j === "object" ? Object.keys(j).sort().join(",") : typeof j); }
      catch { shape = "json:(unparseable)"; }
    } else {
      shape = type.split(";")[0] || "(none)";
    }
    return { status: res.status, shape };
  } catch (err) {
    return { status: "ERR", shape: err.message };
  }
}

let diffs = 0;
console.log(`old: ${oldBase}\nnew: ${newBase}\n`);
for (const c of CHECKS) {
  const [a, b] = await Promise.all([hit(oldBase, c), hit(newBase, c)]);
  const same = a.status === b.status && a.shape === b.shape;
  if (!same) diffs++;
  console.log(`${same ? "OK  " : "DIFF"} ${c.method.padEnd(4)} ${c.path}`);
  console.log(`       old: ${a.status} ${a.shape}`);
  if (!same) console.log(`       new: ${b.status} ${b.shape}`);
}

// Router sanity (new deployment only): an unknown action must be a JSON 404.
const unknown = await hit(newBase, get("/api/invites?action=does-not-exist"));
const unknownOk = unknown.status === 404;
if (!unknownOk) diffs++;
console.log(`${unknownOk ? "OK  " : "DIFF"} GET  /api/invites?action=does-not-exist (new only, expect 404)\n       new: ${unknown.status} ${unknown.shape}`);

console.log(diffs === 0 ? "\nAll endpoints match." : `\n${diffs} difference(s) found.`);
process.exit(diffs === 0 ? 0 : 1);
