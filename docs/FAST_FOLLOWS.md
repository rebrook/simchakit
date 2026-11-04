# Fast follows

Small, near-term items that came out of recent work. Not roadmap features. Newest first within each group. Move an item to the changelog when it ships, and delete it here.

## Do soon

- **Admin Purchases: Stripe links always open test mode.** `client/src-admin/components/pages/PurchasesPage.jsx` (line 169) hardcodes `/test/` in the Stripe payment link, so a live payment opens the test dashboard and is not found. Use `/test/` only when the session id starts with `cs_test`. Admin-only; needs a root `changelog.json` entry, no host-facing What's new entry.
- **Metrics and the Purchases header count the owner's own test purchases.** Two of the five "paid" purchases (session ids start `cs_test`) and two of the four coupon purchases are the owner's own accounts, so revenue shows $145 where real revenue is $87. Leave test purchases out of `metrics-summary` (and decide whether the Purchases page header should too). Counts only, no new personal data.

## Before a marketing push

- **Spot-check `docs/screenshots`** for any real guest names before the repo or docs are shared more widely.

## Housekeeping

- If the repo goes private: replace the README release badge with a static one or remove it.
