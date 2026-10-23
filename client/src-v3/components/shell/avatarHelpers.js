// Moved verbatim from AppShell.jsx (V4.47.0 module split) — no behavior changes.


// ── Co-planner avatar helpers ──────────────────────────────────────────────
const AVATAR_FILLS = [
  "#9b2335",  // rose
  "#0d1b2e",  // navy
  "#2d6a4f",  // forest
  "#5b3a8c",  // purple
  "#4a5568",  // slate
  "#8b4c2a",  // copper
  "#1a6b6b",  // teal
  "#2d3748",  // charcoal
  "#8c5a6e",  // blush
];

export function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_FILLS[Math.abs(hash) % AVATAR_FILLS.length];
}

export function avatarInitials(displayName, email) {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}
