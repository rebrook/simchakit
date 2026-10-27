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

// Words that open a name without being one: articles, titles, honorifics.
const NAME_LEAD = new Set(["the", "a", "an", "mr", "mrs", "ms", "miss", "mx", "dr", "prof", "rabbi", "rev", "hon", "sir", "madam", "and"]);

/**
 * First name for a greeting, from a stored display name. Skips leading articles and titles
 * ("The Brook Family" -> "Brook", "Dr. Sam Levi" -> "Sam"). Returns null when nothing usable is
 * left, so the caller can greet without a name.
 * @param {string|null} name
 * @returns {string|null}
 */
export function firstNameFrom(name) {
  if (!name || typeof name !== "string") return null;
  const words = name.trim().split(/\s+/).map(w => w.replace(/^[^\p{L}]+|[^\p{L}'\u2019-]+$/gu, ""));
  let word = words.find(w => w && !NAME_LEAD.has(w.toLowerCase()));
  if (word && word.includes(".")) word = word.split(".")[0];   // an email-style name such as ryan.brook
  if (!word) return null;
  return word.charAt(0).toUpperCase() + word.slice(1);
}
