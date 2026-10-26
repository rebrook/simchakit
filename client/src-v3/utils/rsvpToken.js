// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.3.0 — utils/rsvpToken.js
// Private RSVP link tokens. A token is 128 random bits (22 URL-safe characters),
// never derived from any id. It is a bearer secret: whoever holds the link can
// answer for that household, so it must never reach analytics, error reports or
// logs. redactRsvpPath() replaces it wherever a URL could be recorded.
//
// Dependency-free and runtime-agnostic (browser and Node 18+): api/_lib imports
// this file by relative path, so the token format lives in exactly one place.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

function generateRsvpToken() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const isValidRsvpToken = (value) => typeof value === "string" && TOKEN_RE.test(value);

// https://<app>/r/<token>
const rsvpLink = (origin, token) => `${String(origin).replace(/\/+$/, "")}/r/${token}`;

// "/r/abc…" -> "/r/[token]" anywhere in a URL, path or free text (error messages, stacks).
const redactRsvpPath = (text) =>
  typeof text === "string" ? text.replace(/\/r\/[A-Za-z0-9_-]{16,}/g, "/r/[token]") : text;

export { generateRsvpToken, isValidRsvpToken, rsvpLink, redactRsvpPath };
