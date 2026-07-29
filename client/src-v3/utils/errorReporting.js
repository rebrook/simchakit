// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.20.0 — utils/errorReporting.js
// Shared capture-and-send logic for client-side crashes, used by both
// components/shared/ErrorBoundary.jsx (render/lifecycle errors) and the
// window "error"/"unhandledrejection" listeners registered in App.v3.jsx
// (event-handler and async errors, which Error Boundaries cannot catch).
//
// Delivery is two-pronged, mirroring existing patterns in this codebase:
//   - Persistent log: insert into client_errors (jsonb payload, same shape
//     convention as audit_log). See
//     migrations/2026-07-28_create_client_errors.sql.
//   - Immediate alert: POST to /api/notify with type "client_error", the
//     same endpoint already used for new-user/new-event admin emails.
//
// Neither delivery path can ever throw back into the caller — a broken
// error reporter must not cause a second crash. Fire-and-forget, same
// posture as writeAuditLog and the Brevo syncs.
//
// De-duplication: a render-loop or a truly deterministic crash could
// otherwise fire dozens of identical reports per session. Each unique
// error signature (source + message + component stack) is capped at a
// small number of reports per browser session via sessionStorage.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase.js";

const DEDUPE_KEY_PREFIX      = "simchakit-error-reported:";
const DEDUPE_MAX_PER_SESSION = 2;

function hashString(str) {
  // Small, fast, non-cryptographic hash — just needs to be stable and
  // collision-unlikely enough for a session-scoped dedupe key, not secure.
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function shouldReport(signature) {
  try {
    const key = DEDUPE_KEY_PREFIX + signature;
    const count = parseInt(sessionStorage.getItem(key) || "0", 10);
    if (count >= DEDUPE_MAX_PER_SESSION) return false;
    sessionStorage.setItem(key, String(count + 1));
    return true;
  } catch {
    // sessionStorage unavailable (rare, e.g. some private-browsing modes) —
    // fail open and report anyway rather than silently drop the error.
    return true;
  }
}

/**
 * Captures and reports a client-side error. Never throws.
 *
 * @param {Error|any} error - the thrown value; usually an Error, not guaranteed.
 * @param {Object} context
 * @param {string} context.source - which boundary/listener caught this, e.g.
 *   "tab:budget", "app-shell", "window.onerror", "unhandledrejection".
 * @param {string} [context.componentStack] - React's componentStack, if available.
 * @param {string} [context.eventId]
 * @param {string} [context.activeTab]
 * @param {string} [context.collaboratorRole]
 * @param {Object} [context.session] - Supabase session, if signed in.
 * @returns {Promise<string|null>} the generated errorId, or null if reporting
 *   itself failed (still safe to call — never throws).
 */
export async function reportClientError(error, context = {}) {
  try {
    const errorId = generateErrorId();
    const message  = error?.message || String(error);
    const stack    = error?.stack || null;
    const signature = hashString(
      `${context.source || ""}:${message}:${context.componentStack || ""}`.slice(0, 500)
    );

    console.error(`[SimchaKit] Client error [${errorId}] (${context.source || "unknown"})`, error, context);

    if (!shouldReport(signature)) {
      console.warn(`[SimchaKit] Suppressing repeat report for ${errorId} — already reported this signature this session`);
      return errorId;
    }

    const payload = {
      errorId,
      source:           context.source || "unknown",
      message,
      stack,
      componentStack:   context.componentStack || null,
      path:             typeof window !== "undefined" ? window.location.pathname : null,
      eventId:          context.eventId || null,
      activeTab:        context.activeTab || null,
      collaboratorRole: context.collaboratorRole || null,
      userId:           context.session?.user?.id || null,
      userEmail:        context.session?.user?.email || null,
      userAgent:        typeof navigator !== "undefined" ? navigator.userAgent : null,
      viewport:         typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
      online:           typeof navigator !== "undefined" ? navigator.onLine : null,
      timestamp:        new Date().toISOString(),
    };

    // Persistent log — fire-and-forget, never blocks, never throws back.
    supabase.from("client_errors").insert({
      event_id: payload.eventId,
      data:     payload,
    }).then(({ error: dbErr }) => {
      if (dbErr) console.warn("[SimchaKit] client_errors insert failed", dbErr.message);
    });

    // Immediate admin alert — same endpoint used for new-user/new-event emails.
    fetch("/api/notify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type: "client_error", data: payload }),
    }).catch((err) => console.warn("[SimchaKit] notify (client_error) failed", err));

    return errorId;
  } catch (reportingErr) {
    // The reporter itself must never throw — that would compound the crash
    // it was trying to report.
    console.error("[SimchaKit] Error reporting failed", reportingErr);
    return null;
  }
}
