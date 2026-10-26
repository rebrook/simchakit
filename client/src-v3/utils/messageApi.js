// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — utils/messageApi.js
// Client side of guest messaging:
//   * callGuestApi: POST /api/guest?action=send|test with the user's bearer token
//     (identity is the token; nothing in the body says who is calling).
//   * markSent / undoMark: manual "I sent these another way" records. They write
//     message_log + message_recipients straight from the browser under the
//     owner/editor RLS policies from V5.0-M1 (never on archived events); no
//     serverless function, no email, no Brevo call.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase.js";
import { kindLabel, channelLabel } from "@/utils/messageTemplates.js";

// Resolves { ok, status, data }. Network failures resolve { ok:false, offline:true }.
async function callGuestApi(action, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { ok: false, status: 401, data: { error: "UNAUTHORIZED" } };
  try {
    const res = await fetch(`/api/guest?action=${action}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, offline: true, status: 0, data: {} };
  }
}

// Plain-language text for an error response from /api/guest.
function describeApiError(result) {
  if (result.offline) return "You appear to be offline. Check your connection and try again.";
  const { status, data } = result;
  if (status === 429) return data.message || "Too many messages sent recently. Please wait a bit and try again.";
  if (status === 403) return "Only the event owner and editors can send messages.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 409) return data.message || "This event is archived and read-only.";
  if (status === 400) return data.message || "The message could not be sent as written.";
  return data.message || "Something went wrong sending the message. Please try again.";
}

// Records a manual send. Returns { messageId } or throws.
async function markSent({ eventId, kind, channel, date, householdIds }) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;
  const sentAt = new Date(`${date}T12:00:00`).toISOString();

  const { data: log, error: logError } = await supabase
    .from("message_log")
    .insert({
      event_id:        eventId,
      kind,
      channel,
      subject:         `${kindLabel(kind)} (${channelLabel(channel).toLowerCase()})`,
      body_snapshot:   "",
      sent_by:         userId,
      sent_at:         sentAt,
      recipient_count: householdIds.length,
    })
    .select("id")
    .single();
  if (logError || !log) throw new Error(logError?.message || "Could not record the mailing.");

  const { error: recipError } = await supabase
    .from("message_recipients")
    .insert(householdIds.map(id => ({ message_id: log.id, household_id: id, email: null, status: "sent" })));
  if (recipError) {
    await supabase.from("message_log").delete().eq("id", log.id);
    throw new Error(recipError.message);
  }
  return { messageId: log.id };
}

// Undo: deleting the log row cascades to its recipients.
async function undoMark(messageId) {
  const { error } = await supabase.from("message_log").delete().eq("id", messageId);
  if (error) throw new Error(error.message);
}

export { callGuestApi, describeApiError, markSent, undoMark };
