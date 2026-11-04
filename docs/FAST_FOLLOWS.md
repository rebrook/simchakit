# Fast follows

Small, near-term items that came out of recent work. Not roadmap features. Newest first within each group. Move an item to the changelog when it ships, and delete it here.

## Do soon

- **nodemailer major upgrade.** The one remaining `npm audit` finding in shipped packages (`notify.js` Gmail path). Review that no user-supplied value reaches an email header or address, then upgrade on its own and test the notification email. Stripe 14 to a current major is a separate session, tested against checkout and the webhook.
- **Getting ready progress in the metrics.** Deferred: it would need the client's setup-state logic on the server. Only worth it if it can reuse `src-v3/utils/setupState.js` without a copy.

## Before a marketing push

- **Spot-check `docs/screenshots`** for any real guest names before the repo or docs are shared more widely.

## Housekeeping

- If the repo goes private: replace the README release badge with a static one or remove it.
