// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5 — api/_lib/guest-unsub.js
// Signed unsubscribe links for guest email. The token is an HMAC of
// eventId + householdId, so a link can only opt out the household it was issued
// for and cannot be forged or enumerated without GUEST_UNSUBSCRIBE_SECRET.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "node:crypto";

export const UNSUBSCRIBE_BASE_URL = "https://app.simcha-kit.com/api/guest";

export function signUnsubscribe(secret, eventId, householdId) {
  return createHmac("sha256", secret).update(`${eventId}.${householdId}`).digest("base64url");
}

export function verifyUnsubscribe(secret, eventId, householdId, token) {
  if (!secret || typeof token !== "string") return false;
  const expected = Buffer.from(signUnsubscribe(secret, eventId, householdId));
  const given    = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildUnsubscribeUrl(secret, eventId, householdId) {
  const params = new URLSearchParams({ action: "unsubscribe", e: eventId, h: householdId, t: signUnsubscribe(secret, eventId, householdId) });
  return `${UNSUBSCRIBE_BASE_URL}?${params.toString()}`;
}
