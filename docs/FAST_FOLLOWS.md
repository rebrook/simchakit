# Fast follows

Small, near-term items that came out of recent work. Not roadmap features. Newest first within each group. Move an item to the changelog when it ships, and delete it here.

## Do soon

- **Harden authentication on older API endpoints.** Several older handlers need server-side JWT verification instead of trusting request data. The repo is public, so keep details out of this file; the specifics are in the owner's private notes.
- **Lock an event when its purchase is refunded.** The admin refund currently only marks the purchase as refunded; the event stays fully usable. Decided 2026-11-03: a refund should end access. Needs a decision on what "lock" means (read-only like an archived event is the natural choice), a migration or RLS check if needed, and a changelog entry. The Stripe refund itself is still done in the Stripe dashboard.
- **Move the owner notification email addresses out of the code** (`client/api/_lib/notify.js`) into an environment variable.
- **Retire or update the intro-price code** in `create-checkout-session.js` (`INTRO_CUTOFF` of 2026-08-31 has passed; checkout already charges the regular price).

## Before a marketing push

- **Spot-check `docs/screenshots`** for any real guest names before the repo or docs are shared more widely.

## Housekeeping

- Stop tracking the Synology `@eaDir` metadata files in git (84 tracked) and add them to `.gitignore` properly.
- If the repo goes private: replace the README release badge with a static one or remove it.
