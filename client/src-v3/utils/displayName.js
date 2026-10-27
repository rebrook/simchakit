// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — utils/displayName.js
// Resolves a human-readable display name from a stored name and email address.
// Used everywhere identity is shown: footer, collaborator panel, invite email.
//
// Rules:
//   1. If name is set and non-empty, return it as-is
//   2. If name is null/empty, return the portion of email before the @ symbol
//   3. If neither is available, return "Someone" as a safe fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a display name for a user.
 * @param {string|null} name  - user_profiles.display_name (may be null)
 * @param {string|null} email - user email address (may be null)
 * @returns {string}
 */
export function displayName(name, email) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes("@")) return email.split("@")[0];
  return "Someone";
}

/**
 * Returns "Name (email)" format for footer and identity surfaces.
 * @param {string|null} name
 * @param {string|null} email
 * @returns {string}
 */
export function displayNameWithEmail(name, email) {
  const n = displayName(name, email);
  if (!email) return n;
  // If display name is the email prefix, just show the full email
  if (n === email.split("@")[0]) return email;
  return `${n} (${email})`;
}
