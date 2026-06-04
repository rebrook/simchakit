// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/accept-invite.js
// Vercel serverless function.
// POST { token, userId }
// Validates a collaborator invitation token and creates the collaborator row.
// Called by the app after confirming the user is authenticated.
//
// Flow:
//   1. Validate request body (token, userId both required)
//   2. Look up invitation by token using service role key
//   3. Reject if not found, expired, or already accepted
//   4. Reject if event has reached the collaborator cap (5)
//   5. Reject if user is already a collaborator on this event
//   6. Insert row into event_collaborators
//   7. Stamp accepted_at on the invitation row
//   8. Sync contact to Brevo (non-fatal — does not block on failure)
//   9. Return { accepted: true, eventId, role }
//
// Error codes returned to the app:
//   TOKEN_NOT_FOUND     — no invitation matches this token
//   TOKEN_EXPIRED       — invitation is past its 7-day expiry
//   ALREADY_ACCEPTED    — this token has already been used
//   ALREADY_COLLABORATOR — this user is already on this event
//   CAP_REACHED         — event has 5 collaborators (the maximum)
//
// Brevo lists:
//   9  — SimchaKit - Collaborators (Editors)
//   10 — SimchaKit - Collaborators (Viewers)
//   11 -- SimchaKit - Ritual Coordinators
//
// New Brevo contact attributes set here:
//   IS_COLLABORATOR      (boolean true)
//   COLLABORATOR_ROLE    ("editor" or "viewer")
//   COLLABORATOR_EVENT_ID (UUID string)
// ─────────────────────────────────────────────────────────────────────────────

const BREVO_CONTACTS_URL   = "https://api.brevo.com/v3/contacts";
const COLLABORATOR_CAP     = 5;
const BREVO_LIST_EDITORS   = 9;  // SimchaKit - Collaborators (Editors)
const BREVO_LIST_VIEWERS   = 10; // SimchaKit - Collaborators (Viewers)
const BREVO_LIST_COORDINATORS = 11; // SimchaKit - Ritual Coordinators

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error("[SimchaKit] accept-invite: BREVO_API_KEY is not set.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const { token, userId } = req.body || {};

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Missing or invalid token." });
  }
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing or invalid userId." });
  }

  // ── Supabase client (service role — bypasses RLS for token lookup and insert) ──
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Step 1: Look up invitation by token ──────────────────────────────────────
  const { data: invitation, error: inviteError } = await supabase
    .from("event_invitations")
    .select("id, event_id, role, expires_at, accepted_at, email, invited_by, invited_by_email, invited_by_name")
    .eq("token", token)
    .single();

  if (inviteError || !invitation) {
    return res.status(404).json({ error: "TOKEN_NOT_FOUND" });
  }

  // ── Step 2: Reject if expired ────────────────────────────────────────────────
  if (new Date(invitation.expires_at) < new Date()) {
    return res.status(410).json({ error: "TOKEN_EXPIRED" });
  }

  // ── Step 3: Reject if already accepted ──────────────────────────────────────
  if (invitation.accepted_at) {
    return res.status(409).json({ error: "ALREADY_ACCEPTED" });
  }

  // ── Step 4: Reject if user is already a collaborator on this event ───────────
  const { data: existingRow } = await supabase
    .from("event_collaborators")
    .select("id")
    .eq("event_id", invitation.event_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingRow) {
    return res.status(409).json({ error: "ALREADY_COLLABORATOR" });
  }

  // ── Step 5: Enforce collaborator cap ─────────────────────────────────────────
  // Coordinators do not count against the family's cap and are never blocked by
  // it, so they are excluded from the count and the check is skipped for them.
  if (invitation.role !== "coordinator") {
    const { count, error: countError } = await supabase
      .from("event_collaborators")
      .select("id", { count: "exact", head: true })
      .eq("event_id", invitation.event_id)
      .neq("role", "coordinator")
      .not("accepted_at", "is", null);

    if (countError) {
      console.error("[SimchaKit] accept-invite: collaborator count failed:", countError.message);
      return res.status(500).json({ error: "Failed to validate collaborator count." });
    }

    if (count >= COLLABORATOR_CAP) {
      return res.status(403).json({ error: "CAP_REACHED" });
    }
  }

  // ── Resolve invitee email early — needed for both the insert and Brevo sync ──
  let inviteeEmail = invitation.email || null;
  if (!inviteeEmail) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    inviteeEmail = profile?.email || null;
  }

  // ── Resolve invited_by_name -- use value stored on invitation if present,
  // otherwise look up from user_profiles using invited_by UUID ──────────────────
  let invitedByEmail = invitation.invited_by_email || null;
  let invitedByName  = invitation.invited_by_name  || null;
  if ((!invitedByEmail || !invitedByName) && invitation.invited_by) {
    const { data: ownerProfile } = await supabase
      .from("user_profiles")
      .select("email, display_name")
      .eq("id", invitation.invited_by)
      .maybeSingle();
    if (!invitedByEmail) invitedByEmail = ownerProfile?.email || null;
    if (!invitedByName)  invitedByName  = ownerProfile?.display_name || null;
  }

  // ── Step 6: Insert collaborator row ─────────────────────────────────────────
  const now = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("event_collaborators")
    .insert({
      event_id:         invitation.event_id,
      user_id:          userId,
      role:             invitation.role,
      invited_by:       invitation.invited_by,
      invited_by_email: invitedByEmail,
      invited_by_name:  invitedByName,
      invited_at:       now,
      accepted_at:      now,
      email:            inviteeEmail,
    });

  if (insertError) {
    console.error("[SimchaKit] accept-invite: insert failed:", insertError.message);
    return res.status(500).json({ error: "Failed to create collaborator record." });
  }

  // ── Step 7: Stamp accepted_at on the invitation ──────────────────────────────
  const { error: stampError } = await supabase
    .from("event_invitations")
    .update({ accepted_at: now })
    .eq("id", invitation.id);

  if (stampError) {
    // Non-fatal — collaborator row already inserted. Log and continue.
    console.error("[SimchaKit] accept-invite: invitation stamp failed:", stampError.message);
  }

  // ── Step 8: Brevo sync (non-fatal — does not block on failure) ───────────────
  // Email already resolved above. Always set collaborator attributes on the contact.
  // Only skip the list addition if the contact is already on the owner journey
  // (lists 3 or 6) -- owner journey takes precedence for list membership.
  try {

    if (inviteeEmail) {
      const brevoListId =
        invitation.role === "editor"      ? BREVO_LIST_EDITORS :
        invitation.role === "coordinator" ? BREVO_LIST_COORDINATORS :
                                            BREVO_LIST_VIEWERS;

      const brevoHeaders = {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      BREVO_API_KEY,
      };

      // Check whether this contact is already on the owner journey (lists 3 or 6).
      // If so, skip the list addition -- owner journey takes precedence.
      const checkResponse = await fetch(
        `${BREVO_CONTACTS_URL}/${encodeURIComponent(inviteeEmail)}`,
        { method: "GET", headers: brevoHeaders }
      );

      let skipListAdd = false;
      if (checkResponse.status === 200) {
        const contactData = await checkResponse.json();
        const existingLists = contactData.listIds || [];
        if (existingLists.includes(3) || existingLists.includes(6)) {
          skipListAdd = true;
        }
      }

      const contactPayload = {
        email: inviteeEmail,
        updateEnabled: true,
        attributes: {
          IS_COLLABORATOR:       true,
          COLLABORATOR_ROLE:     invitation.role,
          COLLABORATOR_EVENT_ID: invitation.event_id,
        },
        ...(!skipListAdd && brevoListId != null && { listIds: [brevoListId] }),
      };

      const brevoResponse = await fetch(BREVO_CONTACTS_URL, {
        method:  "POST",
        headers: brevoHeaders,
        body:    JSON.stringify(contactPayload),
      });

      if (brevoResponse.status !== 201 && brevoResponse.status !== 204) {
        const errorBody = await brevoResponse.text();
        console.error(`[SimchaKit] accept-invite: Brevo sync failed (${brevoResponse.status}):`, errorBody);
        // Non-fatal — collaborator already has database access. Continue.
      }
    }
  } catch (brevoErr) {
    console.error("[SimchaKit] accept-invite: Brevo sync error:", brevoErr.message);
    // Non-fatal — log and continue.
  }

  // ── Step 9: Return success ───────────────────────────────────────────────────
  return res.status(200).json({
    accepted: true,
    eventId:  invitation.event_id,
    role:     invitation.role,
  });
}
