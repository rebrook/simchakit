// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5 — api/_lib/brevo.js
// Shared Brevo helper for guest messaging. Same endpoint and headers as
// api/brevo-sync.js and api/send-invite.js. The underscore prefix keeps Vercel
// from deploying this file as its own function.
// ─────────────────────────────────────────────────────────────────────────────

export const BREVO_TRANSACTIONAL_URL = "https://api.brevo.com/v3/smtp/email";

export function brevoHeaders(apiKey) {
  return {
    "accept":       "application/json",
    "content-type": "application/json",
    "api-key":      apiKey,
  };
}

// Sends one transactional email. Never throws: resolves { ok, providerId, error }.
// Brevo returns 201 { messageId } on success.
export async function sendBrevoEmail(apiKey, payload) {
  try {
    const response = await fetch(BREVO_TRANSACTIONAL_URL, {
      method:  "POST",
      headers: brevoHeaders(apiKey),
      body:    JSON.stringify(payload),
    });
    if (response.status === 201) {
      const body = await response.json().catch(() => ({}));
      return { ok: true, providerId: body.messageId || null, error: null };
    }
    const text = await response.text().catch(() => "");
    return { ok: false, providerId: null, error: `Brevo ${response.status}: ${text}`.slice(0, 500) };
  } catch (err) {
    return { ok: false, providerId: null, error: `Brevo request failed: ${err.message}`.slice(0, 500) };
  }
}
