// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.19.0 — utils/router.js
// Minimal history-based routing helpers. No router library — App.v3.jsx and
// AppShell.jsx each own their half of the URL (selectedEventId and activeTab
// respectively) and each attaches its own popstate listener; these are just
// the shared pure functions so the route shape and regex live in one place.
//
// Routes:
//   "/"                    — event picker
//   "/e/:eventId"          — event overview (canonical form for "overview")
//   "/e/:eventId/:tab"     — a specific tab
//
// Out of scope here (handled elsewhere, unchanged by this file):
//   "/demo", "/invite/:token", and the auth-callback hash/code detection.
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_ROUTE = /^\/e\/([0-9a-f-]{36})(?:\/([a-z]+))?\/?$/i;

/**
 * Parses a pathname into { eventId, tab }, or null if it isn't an /e/... route.
 * `tab` is null for the bare /e/:eventId form (the canonical "overview" URL) —
 * callers that need a concrete tab id should treat null as "overview".
 */
export function parseEventRoute(pathname) {
  const m = pathname.match(EVENT_ROUTE);
  if (!m) return null;
  return { eventId: m[1], tab: m[2] || null };
}

/**
 * Builds the canonical path for a given event + tab. "overview" (or a falsy
 * tab) collapses to the bare /e/:eventId form rather than /e/:eventId/overview.
 */
export function buildEventPath(eventId, tab) {
  return tab && tab !== "overview" ? `/e/${eventId}/${tab}` : `/e/${eventId}`;
}

/**
 * Pushes the canonical path for eventId + tab, unless we're already there
 * (avoids piling up duplicate history entries from redundant navigateTo calls).
 */
export function pushEventPath(eventId, tab) {
  const path = buildEventPath(eventId, tab);
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
}
