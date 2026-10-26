// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/calendar.js
// Router (V5-P0): generate-token, subscribe
// Dispatches on req.query.action; old URLs reach it through rewrites in
// vercel.json / vercel.admin.json. Each handler lives, unchanged, in api/_lib/.
// Do not add files under api/ without checking the 12-function limit; add an
// action to a router instead.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = {
  "generate-token": () => import("./_lib/calendar-generate-token.js"),
  "subscribe": () => import("./_lib/calendar-subscribe.js"),
};

export default async function handler(req, res) {
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  const load = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!load) {
    return res.status(404).json({ error: "Not found" });
  }
  const mod = await load();
  return mod.default(req, res);
}
