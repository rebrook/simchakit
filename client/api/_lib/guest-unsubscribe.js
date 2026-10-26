// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5 — api/_lib/guest-unsubscribe.js (action "unsubscribe" of api/guest.js)
// Vercel serverless function. Public (guests are not logged in), so access is
// gated by an HMAC-signed token and every input is validated; the table is never
// opened to the anon role.
//
// GET  /api/guest?action=unsubscribe&e=<eventId>&h=<householdId>&t=<token>  -> confirmation page (changes nothing,
//      so email scanners that prefetch links cannot opt anyone out)
// POST same query (or form body)                 -> sets households.email_opt_out = true.
//      Also the target of the List-Unsubscribe-Post one-click header.
// ─────────────────────────────────────────────────────────────────────────────

import { verifyUnsubscribe } from "./guest-unsub.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function page(res, status, title, message, form) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
:root{--bg:#fff;--fg:#222;--muted:#666;--accent:#7a3b52;--on-accent:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#1a1a1a;--fg:#eee;--muted:#aaa;--accent:#d98aa6;--on-accent:#1a1a1a}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 Arial,Helvetica,sans-serif}
main{max-width:480px;margin:0 auto;padding:48px 16px}
h1{font-size:22px;margin:0 0 12px}p{margin:0 0 20px}
button{min-height:44px;padding:0 20px;border:0;border-radius:8px;background:var(--accent);color:var(--on-accent);font:inherit;cursor:pointer}
small{color:var(--muted)}
</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${form || ""}
<p><small>Sent with SimchaKit</small></p></main></body></html>`);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const src = { ...(typeof req.body === "object" && req.body ? req.body : {}), ...(req.query || {}) };
  const e = typeof src.e === "string" ? src.e : "";
  const h = typeof src.h === "string" ? src.h : "";
  const t = typeof src.t === "string" ? src.t : "";

  const secret = process.env.GUEST_UNSUBSCRIBE_SECRET;
  if (!secret) {
    console.error("[SimchaKit] guest-unsubscribe: GUEST_UNSUBSCRIBE_SECRET is not set.");
    return page(res, 500, "Something went wrong", "Please try again later.");
  }
  if (!UUID_RE.test(e) || !h || h.length > 100 || !verifyUnsubscribe(secret, e, h, t)) {
    return page(res, 400, "Link not valid", "This unsubscribe link is invalid or incomplete.");
  }

  if (req.method === "GET") {
    const form = `<form method="POST" action="?${new URLSearchParams({ action: "unsubscribe", e, h, t }).toString()}"><button type="submit">Unsubscribe</button></form>`;
    return page(res, 200, "Unsubscribe", "Stop receiving emails about this event?", form);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase
    .from("households")
    .update({ email_opt_out: true })
    .eq("event_id", e)
    .eq("id", h);
  if (error) {
    console.error("[SimchaKit] guest-unsubscribe: update failed:", error.message);
    return page(res, 500, "Something went wrong", "We couldn't update your preference. Please try again.");
  }
  return page(res, 200, "You're unsubscribed", "You won't receive more emails about this event.");
}
