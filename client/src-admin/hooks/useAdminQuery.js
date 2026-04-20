// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit Admin — hooks/useAdminQuery.js
// Thin wrapper around POST /api/admin-query.
// ─────────────────────────────────────────────────────────────────────────────

export async function adminQuery(token, query, params = {}) {
  const res = await fetch("/api/admin-query", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ token, query, params }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Admin query failed.");
  return json.data;
}
