// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — hooks/useCollaboratorRole.js
// Returns the current user's role on the active event.
// Possible return values:
//   'owner'  — user owns the event (event.owner_id === session.user.id)
//   'editor' — user is an accepted Editor collaborator
//   'viewer' — user is an accepted Viewer collaborator
//   null     — role not yet resolved (loading) or not applicable (demo mode)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase.js";

export function useCollaboratorRole(eventOwnerId, eventId, userId) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!eventOwnerId || !eventId || !userId) {
      setRole(null);
      return;
    }

    // Owner check is synchronous — no DB query needed
    if (eventOwnerId === userId) {
      setRole("owner");
      return;
    }

    // Not the owner — query event_collaborators for this user's role
    supabase
      .from("event_collaborators")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .maybeSingle()
      .then(({ data }) => {
        setRole(data?.role || null);
      });
  }, [eventOwnerId, eventId, userId]);

  return role;
}
