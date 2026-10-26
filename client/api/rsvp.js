// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/rsvp.js
// Router (V5-R1): the guest RSVP site's backend. One serverless function.
//   GET  /api/rsvp  (header X-RSVP-Token)  -> the guest's own household view
//   POST /api/rsvp  { token?, answers, details, address, note, newGuests } -> stores a reply
// The private token travels in a header or the POST body, never the URL, so it stays
// out of request logs. Unlike the other routers, the action defaults from the HTTP
// method (so the guest page needs no query string); ?action=get|submit also works.
// Do not add files under api/ without checking the 12-function limit; add an
// action to a router instead.
// ─────────────────────────────────────────────────────────────────────────────

import { applyHeaders } from "./_lib/rsvp-shared.js";

const ACTIONS = {
  "get":    () => import("./_lib/rsvp-get.js"),
  "submit": () => import("./_lib/rsvp-submit.js"),
};

export default async function handler(req, res) {
  applyHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const requested = typeof req.query?.action === "string" ? req.query.action : "";
  const action = requested || (req.method === "GET" ? "get" : "submit");
  const load = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!load) {
    return res.status(404).json({ error: "Not found" });
  }
  const mod = await load();
  return mod.default(req, res);
}
