// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.6.0 — usePresence.js
// Tracks which co-planners are currently viewing the event using Supabase
// Realtime Presence on a private (RLS-enforced) channel.
//
// Channel:  presence:event:{eventId}
// Payload:  { user_id, display_name }   (no email — no PII on the wire)
// Security: realtime.messages RLS restricts channel to event collaborators.
//           private:true + explicit setAuth ensures the JWT is sent on the
//           WebSocket upgrade so the server can evaluate RLS policies.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase.js";

/**
 * @param {string|null}  eventId          — current event UUID
 * @param {object|null}  session          — Supabase auth session
 * @param {string|null}  displayName      — current user's display name
 * @param {Array|null}   collaboratorIds  — array of user_id strings from the
 *                                          collaborator roster; presence entries
 *                                          not in this set are filtered out
 * @returns {{ onlineUsers: Array<{ user_id: string, display_name: string }> }}
 */
export function usePresence(eventId, session, displayName, collaboratorIds) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    // Guard: need an event, an authenticated user, and a loaded roster
    if (!eventId || !session?.user?.id || !session?.access_token || !collaboratorIds) return;

    const userId      = session.user.id;
    const accessToken = session.access_token;
    const topic       = `presence:event:${eventId}`;

    // Build a Set of known collaborator IDs for fast lookup
    const rosterSet = new Set(collaboratorIds);

    // Explicitly set the Realtime auth token before creating the channel.
    // private:true channels require a valid JWT for RLS policy evaluation.
    // The Supabase client may not always push the token automatically on
    // the WebSocket upgrade in all versions, so this is a safety measure.
    supabase.realtime.setAuth(accessToken);

    const channel = supabase.channel(topic, {
      config: {
        private: true,
        presence: { key: userId },
      },
    });

    channelRef.current = channel;

    // On any presence state change, rebuild the online users list
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const users = [];

      for (const [key, presences] of Object.entries(state)) {
        // Skip self
        if (key === userId) continue;

        // Only include users who are in the collaborator roster
        if (!rosterSet.has(key)) continue;

        // Take the most recent presence entry for this key
        const latest = presences[presences.length - 1];
        if (latest) {
          users.push({
            user_id:      key,
            display_name: latest.display_name || null,
          });
        }
      }

      setOnlineUsers(users);
    });

    // Subscribe and track once connected
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id:      userId,
          display_name: displayName || null,
        });
      }
    });

    // Cleanup on unmount or dependency change
    return () => {
      channelRef.current = null;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [eventId, session?.user?.id, session?.access_token, displayName, collaboratorIds]);

  return { onlineUsers };
}
