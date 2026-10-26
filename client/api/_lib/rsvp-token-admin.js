// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.3.0 — api/_lib/rsvp-token-admin.js  (POST /api/guest?action=rsvp-token)
// Host side of the RSVP links. Body: { eventId, householdId, regenerate? }
// with an Authorization: Bearer <supabase access token> header (same pattern as
// api/_lib/guest-send.js: identity comes only from the token, the caller must be the
// event owner or an accepted editor, archived events are read-only).
//   regenerate omitted/false: returns the household's link, creating its token if it
//     has none yet (lazy creation).
//   regenerate true: replaces the token. The old link stops working at once.
// Returns { link, token }. The token is a bearer secret: it is returned only to the
// owner/editor who asked and is never logged.
// ─────────────────────────────────────────────────────────────────────────────

import { generateRsvpToken, rsvpLink } from "../../src-v3/utils/rsvpToken.js";
import { getServiceClient, ensureTokens, APP_ORIGIN } from "./rsvp-shared.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");

  const supabase = await getServiceClient();

  const authHeader  = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearerToken) return res.status(401).json({ error: "UNAUTHORIZED" });
  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });
  const userId = authData.user.id;

  const { eventId, householdId, regenerate } = req.body || {};
  if (typeof eventId !== "string" || !UUID_RE.test(eventId) || typeof householdId !== "string" || !UUID_RE.test(householdId)
      || (regenerate !== undefined && typeof regenerate !== "boolean")) {
    return res.status(400).json({ error: "INVALID_REQUEST", message: "eventId and householdId must be valid ids." });
  }

  const { data: event } = await supabase.from("events").select("id, owner_id, archived").eq("id", eventId).maybeSingle();
  if (!event) return res.status(404).json({ error: "Event not found." });
  if (event.owner_id !== userId) {
    const { data: collab } = await supabase.from("event_collaborators").select("role")
      .eq("event_id", eventId).eq("user_id", userId).not("accepted_at", "is", null).maybeSingle();
    if (collab?.role !== "editor") return res.status(403).json({ error: "NOT_AUTHORIZED" });
  }
  if (event.archived) return res.status(409).json({ error: "EVENT_ARCHIVED", message: "This event is archived and read-only." });

  const { data: hh } = await supabase.from("households").select("id").eq("id", householdId).eq("event_id", eventId).maybeSingle();
  if (!hh) return res.status(404).json({ error: "Household not found." });

  try {
    let token;
    if (regenerate === true) {
      token = generateRsvpToken();
      const { error } = await supabase.from("household_rsvp_tokens")
        .upsert({ household_id: householdId, event_id: eventId, token }, { onConflict: "household_id" });
      if (error) throw new Error("upsert failed");
    } else {
      token = (await ensureTokens(supabase, eventId, [householdId])).get(householdId);
      if (!token) throw new Error("no token");
    }
    return res.status(200).json({ link: rsvpLink(APP_ORIGIN, token), token });
  } catch {
    console.error("[SimchaKit] rsvp-token: could not create or replace a token.");
    return res.status(500).json({ error: "Failed to prepare the RSVP link." });
  }
}
