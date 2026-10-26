// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.3.0 — api/_lib/rsvp-get.js  (GET /api/rsvp, header X-RSVP-Token)
// Returns the guest's own household view (see buildView in rsvp-shared.js), or a
// friendly closed state. An unknown token gets the same 404 as any other miss.
// No login: the private token is the credential.
// ─────────────────────────────────────────────────────────────────────────────

import { isValidRsvpToken } from "../../src-v3/utils/rsvpToken.js";
import { getServiceClient, loadByToken, buildView, readToken, rateLimited, clientIp } from "./rsvp-shared.js";

const NOT_FOUND = { error: "NOT_FOUND", message: "This link isn't valid. Please check it or ask your host to resend it." };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (rateLimited("get-ip", clientIp(req), 60, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." });
  }

  const token = readToken(req);
  if (!isValidRsvpToken(token)) return res.status(404).json(NOT_FOUND);
  if (rateLimited("get-token", token, 60, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." });
  }

  try {
    const supabase = await getServiceClient();
    const ctx = await loadByToken(supabase, token);
    if (!ctx) return res.status(404).json(NOT_FOUND);
    return res.status(200).json(buildView(ctx));
  } catch {
    // Deliberately no request details in the log: the token is a secret.
    console.error("[SimchaKit] rsvp-get: lookup failed.");
    return res.status(500).json({ error: "SERVER_ERROR", message: "Something went wrong. Please try again in a moment." });
  }
}
