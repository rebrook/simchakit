// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/guest.js
// Router (V5-M1): send, unsubscribe
// Dispatches on req.query.action (no old URLs: called as /api/guest?action=...).
// Each handler lives in api/_lib/.
// Do not add files under api/ without checking the 12-function limit; add an
// action to a router instead.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = {
  "send": () => import("./_lib/guest-send.js"),
  "unsubscribe": () => import("./_lib/guest-unsubscribe.js"),
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
