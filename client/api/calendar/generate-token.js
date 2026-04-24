// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.5.0 — api/calendar/generate-token.js
// Vercel serverless function — requires authenticated owner.
// POST { eventId, userId }
// Generates a new calendar_token UUID for the event, invalidating the old one.
// Returns { token } on success.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple UUID v4 generator — no external dependency needed
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { eventId, userId } = req.body || {};

  if (!eventId || !userId) {
    return res.status(400).json({ error: "Missing eventId or userId." });
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

  // Generate and save new token
  const newToken = uuidv4();

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
