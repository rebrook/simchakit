// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3.20.0 — update-clergy.js
// Vercel serverless function: scoped write proxy for clergy/tutor fields in
// admin_config. Allows event owners and accepted coordinators to update
// rabbi, cantor, and tutor contacts without direct UPDATE on the events table.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // ── Input ───────────────────────────────────────────────────────────────
  const { eventId, rabbi, cantor, tutor } = req.body || {};
  if (!eventId) {
    return res.status(400).json({ error: "eventId is required" });
  }

  // ── Load event ──────────────────────────────────────────────────────────
  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("owner_id, admin_config")
    .eq("id", eventId)
    .single();

  if (eventError || !eventRow) {
    return res.status(404).json({ error: "Event not found" });
  }

  // ── Authorization: owner or accepted coordinator ────────────────────────
  const isOwner = eventRow.owner_id === user.id;

  let isCoordinator = false;
  if (!isOwner) {
    const { data: collabRow } = await supabase
      .from("event_collaborators")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "coordinator")
      .not("accepted_at", "is", null)
      .limit(1)
      .single();

    isCoordinator = !!collabRow;
  }

  if (!isOwner && !isCoordinator) {
    return res.status(403).json({ error: "Not authorized to update clergy info" });
  }

  // ── Merge only rabbi, cantor, tutor into existing admin_config ──────────
  const sanitize = (contact) => ({
    name:  String(contact?.name  || "").slice(0, 200),
    phone: String(contact?.phone || "").slice(0, 50),
    email: String(contact?.email || "").slice(0, 200),
    notes: String(contact?.notes || "").slice(0, 500),
  });

  const currentConfig = eventRow.admin_config || {};
  const updatedConfig = {
    ...currentConfig,
    rabbi:  sanitize(rabbi),
    cantor: sanitize(cantor),
    tutor:  sanitize(tutor),
  };

  // ── Write back ──────────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("events")
    .update({ admin_config: updatedConfig })
    .eq("id", eventId);

  if (updateError) {
    console.error("[SimchaKit] update-clergy write error:", updateError.message);
    return res.status(500).json({ error: "Could not save clergy info" });
  }

  return res.status(200).json({ ok: true });
}
