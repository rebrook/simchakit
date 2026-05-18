// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/brevo-sync.js
// Vercel serverless function.
// POST { email, isNewUser, attributes }
// Creates or updates a Brevo contact with SimchaKit lifecycle attributes.
//
// Attributes synced:
//   SIGNUP_DATE  — set only when isNewUser = true
//   LAST_LOGIN   — set on every sign-in
//   EVENT_NAME   — set on event creation
//   EVENT_TYPE   — set on event creation
//   EVENT_DATE   — set on event creation (ISO date string or empty string)
//   HAS_PURCHASED — set to true on event creation (never reset to false)
//
// Brevo API: POST https://api.brevo.com/v3/contacts (createContact with updateEnabled)
// ─────────────────────────────────────────────────────────────────────────────

const BREVO_API_URL = "https://api.brevo.com/v3/contacts";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error("[SimchaKit] BREVO_API_KEY environment variable is not set.");
    return res.status(500).json({ error: "Brevo API key not configured." });
  }

  const { email, isNewUser, attributes } = req.body || {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Missing or invalid email." });
  }

  // Build the attributes payload.
  // SIGNUP_DATE is only included when this is a confirmed new user.
  // LAST_LOGIN is always included on sign-in calls.
  // Event attributes (EVENT_NAME, EVENT_TYPE, EVENT_DATE, HAS_PURCHASED) are
  // included only when provided — omitting them leaves existing values untouched.
  const contactAttributes = {};

  if (attributes?.LAST_LOGIN)    contactAttributes.LAST_LOGIN    = attributes.LAST_LOGIN;
  if (isNewUser)                  contactAttributes.SIGNUP_DATE   = attributes?.SIGNUP_DATE || new Date().toISOString().slice(0, 10);
  if (attributes?.EVENT_NAME)    contactAttributes.EVENT_NAME    = attributes.EVENT_NAME;
  if (attributes?.EVENT_TYPE)    contactAttributes.EVENT_TYPE    = attributes.EVENT_TYPE;
  if (attributes?.EVENT_DATE)    contactAttributes.EVENT_DATE    = attributes.EVENT_DATE;
  if (attributes?.HAS_PURCHASED) contactAttributes.HAS_PURCHASED = true;

  const payload = {
    email,
    updateEnabled: true,       // upsert: create if new, update if exists
    attributes: contactAttributes,
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method:  "POST",
      headers: {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    // Brevo returns 201 on create, 204 on update — both are success
    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ synced: true });
    }

    // Any other status is an error — log it but don't crash the caller
    const errorBody = await response.text();
    console.error(`[SimchaKit] Brevo sync failed (${response.status}):`, errorBody);
    return res.status(200).json({ synced: false, brevoStatus: response.status });

  } catch (err) {
    console.error("[SimchaKit] Brevo sync error:", err.message);
    return res.status(200).json({ synced: false, error: err.message });
  }
}
