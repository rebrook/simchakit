// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — api/brevo-sync.js
// Vercel serverless function.
// POST { email, isNewUser, attributes }
// Creates or updates a Brevo contact with SimchaKit lifecycle attributes.
// For new users, adds contact to SimchaKit - New Users list (triggers welcome automation).
// For event creation, sends Event Confirmed transactional email directly.
//
// Attributes synced:
//   SIGNUP_DATE   — set only when isNewUser = true
//   LAST_LOGIN    — set on every sign-in
//   EVENT_NAME    — set on event creation
//   EVENT_TYPE    — set on event creation
//   EVENT_DATE    — set on event creation (ISO date string or empty string)
//   HAS_PURCHASED — set to true on event creation (never reset to false)
//
// Brevo contact API:       POST https://api.brevo.com/v3/contacts
// Brevo transactional API: POST https://api.brevo.com/v3/smtp/email
// Event Confirmed template ID: 4
// SimchaKit - New Users list ID: 3
// ─────────────────────────────────────────────────────────────────────────────

const BREVO_CONTACTS_URL     = "https://api.brevo.com/v3/contacts";
const BREVO_TRANSACTIONAL_URL = "https://api.brevo.com/v3/smtp/email";
const EVENT_CONFIRMED_TEMPLATE_ID = 4;

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

  const headers = {
    "accept":       "application/json",
    "content-type": "application/json",
    "api-key":      BREVO_API_KEY,
  };

  // ── Step 1: Upsert contact with updated attributes ──────────────────────────
  const contactAttributes = {};

  if (attributes?.LAST_LOGIN)    contactAttributes.LAST_LOGIN    = attributes.LAST_LOGIN;
  if (isNewUser)                 contactAttributes.SIGNUP_DATE   = attributes?.SIGNUP_DATE || new Date().toISOString().slice(0, 10);
  if (attributes?.EVENT_NAME)   contactAttributes.EVENT_NAME    = attributes.EVENT_NAME;
  if (attributes?.EVENT_TYPE)   contactAttributes.EVENT_TYPE    = attributes.EVENT_TYPE;
  if (attributes?.EVENT_DATE)   contactAttributes.EVENT_DATE    = attributes.EVENT_DATE;
  if (attributes?.HAS_PURCHASED) contactAttributes.HAS_PURCHASED = true;

  const contactPayload = {
    email,
    updateEnabled: true,
    attributes: contactAttributes,
    ...(isNewUser && { listIds: [3, 6] }), // list 3: New Users (welcome automation), list 6: Prospects (re-engagement automation)
  };

  try {
    const contactResponse = await fetch(BREVO_CONTACTS_URL, {
      method:  "POST",
      headers,
      body: JSON.stringify(contactPayload),
    });

    // Brevo returns 201 on create, 204 on update — both are success
    if (contactResponse.status !== 201 && contactResponse.status !== 204) {
      const errorBody = await contactResponse.text();
      console.error(`[SimchaKit] Brevo contact sync failed (${contactResponse.status}):`, errorBody);
      return res.status(200).json({ synced: false, brevoStatus: contactResponse.status });
    }
  } catch (err) {
    console.error("[SimchaKit] Brevo contact sync error:", err.message);
    return res.status(200).json({ synced: false, error: err.message });
  }

  // ── Step 2: Send Event Confirmed transactional email on event creation ──────
  // Fired on every event creation so the email correctly reflects the specific
  // event that was just created, passed as params at send time.
  if (attributes?.HAS_PURCHASED && attributes?.EVENT_NAME) {
    try {
      const transactionalPayload = {
        to: [{ email }],
        templateId: EVENT_CONFIRMED_TEMPLATE_ID,
        params: {
          EVENT_NAME: attributes.EVENT_NAME,
          EVENT_TYPE: attributes.EVENT_TYPE || "",
        },
      };

      const transactionalResponse = await fetch(BREVO_TRANSACTIONAL_URL, {
        method:  "POST",
        headers,
        body: JSON.stringify(transactionalPayload),
      });

      if (transactionalResponse.status !== 201) {
        const errorBody = await transactionalResponse.text();
        console.error(`[SimchaKit] Brevo transactional email failed (${transactionalResponse.status}):`, errorBody);
      }
    } catch (err) {
      console.error("[SimchaKit] Brevo transactional email error:", err.message);
    }
  }

  return res.status(200).json({ synced: true });
}
