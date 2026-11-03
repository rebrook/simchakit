// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.5.0 — api/calendar/generate-token.js
// Vercel serverless function — requires authenticated owner.
// POST { eventId } with Authorization: Bearer <access token>
// Generates a new calendar_token UUID for the event, invalidating the old one.
// The caller's identity comes only from the token. Returns { token } on success.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import { authenticate } from "./auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "UNAUTHORIZED" });
  const userId   = auth.user.id;
  const supabase = auth.supabase;

  const { eventId } = req.body || {};

  if (!eventId || typeof eventId !== "string") {
    return res.status(400).json({ error: "Missing eventId." });
  }

  // Verify ownership
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("id, owner_id")
    .eq("id", eventId)
    .eq("owner_id", userId)
    .single();

  if (fetchError || !event) {
    return res.status(403).json({ error: "Event not found or access denied." });
  }

  // The token is the only secret protecting the public calendar feed, so it must be unguessable
  const newToken = randomUUID();

  const { error: updateError } = await supabase
    .from("events")
    .update({ calendar_token: newToken, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("owner_id", userId);

  if (updateError) {
    return res.status(500).json({ error: "Could not update calendar token." });
  }

  return res.status(200).json({ token: newToken });
}
