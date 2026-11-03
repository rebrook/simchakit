# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SimchaKit is a hosted event-planning app for simchas (B'nei Mitzvot, weddings) at app.simcha-kit.com: React + Vite frontend, Supabase (Postgres + RLS + Realtime) for data and auth, Vercel serverless functions, Stripe for payments, Brevo for email. `README.md` has the feature list and `DEPLOY.md` the deploy and Supabase reference.

**Only V3 is maintained.** Work in `client/src-v3/`, `client/api/`, `client/src-admin/` and `client/migrations/`. The V2 self-hosted edition (`client/src/`, root `server.js`, root `src/`, `deploy.sh`, `public/`, `data/`) is retired: don't edit it, don't import from it, and ignore it when searching. Ignore `@eaDir` folders and `*@SynoResource` files (Synology NAS metadata); never stage them.

## Commands

Run from `client/`. `npx` is not on the PATH on this NAS, so call Vite through node.

```bash
node node_modules/vite/bin/vite.js build --config vite.config.v3.js --outDir <scratch>/dist   # the build check
npm run lint                           # eslint, currently scoped to src-v3/App.v3.jsx only
node scripts/build-changelog.mjs       # regenerate public/whats-new/*.json from changelog/entries.json
node scripts/check-guide.mjs           # in-app guide content check
node scripts/check-guest-strip.mjs     # host-only data never reaches the guest RSVP payload
node scripts/gen-palette-tokens.mjs    # regenerate src-v3/styles/palette-tokens.css (fails on text contrast < 4.5:1)
node scripts/check-endpoints.mjs <old-url> <new-url>   # compare two deployments' API (from repo root)
```

There is no test suite. Verification means a clean V3 build plus the check scripts relevant to what you touched. **Always pass `--config vite.config.v3.js`.** Plain `vite build` (and `npm run build`) uses the retired V2 config, doesn't compile `src-v3`, and has missed errors that then broke Vercel. The V3 config also runs `build-changelog.mjs` and `check-guide.mjs` when it loads, and both fail the build on a rule break. `npm run dev` also uses the V2 config; for local V3 use `node node_modules/vite/bin/vite.js --config vite.config.v3.js`.

Deploys happen from `main`: Vercel builds `client/` with the V3 config. `src-admin` is a second Vercel project built with `vercel.admin.json` that reuses the same `api/` folder.

## Frontend architecture (`client/src-v3/`)

**Entry and routing.** `App.v3.jsx` branches before any auth hooks run: `/r/<token>` → guest RSVP site (lazy chunk), `/demo` → demo mode (signs out, anon client, hardcoded demo event), otherwise `AuthedApp`. Magic-link sign-in does a full reload, so deep links (`/invite/<uuid>`, `/e/:id/:tab`) are stashed in localStorage and replayed. Event selection is URL-driven (pushState plus a popstate listener in `App.v3.jsx`); tab selection is separate state in `components/shell/AppShell.jsx` with its own popstate listener.

**Shell.** `AppShell.jsx` owns state and routing and renders tabs through a chain of `activeTab === "x" &&` checks with a shared `tabProps` bag. Tab definitions are in `components/shell/shellConfig.js` (`ALL_TABS`, sidebar groups, bottom bar). `applyTabWithPermissionCheck` is the single gate for which tabs a role may see. A new tab needs entries in `shellConfig.js` **and** in the hardcoded tab list in `components/admin/TabsSection.jsx` (Overview is always visible and is not in that list).

**Roles.** `owner`, `editor`, `viewer`, `coordinator` (Ritual Coordinator: ceremony and prep tabs only). `hooks/useCollaboratorRole.js` resolves the role (owner = `events.owner_id`; others from `event_collaborators` where `accepted_at` is set). The hook's header comment omits `coordinator`, but the code uses it. Viewer and archived gating is **per tab, per handler**, not central, so check every new write path for both `isViewer` and `isArchived`. Real enforcement must be RLS and RPC on the server. Admin Mode is owner-only.

**Data layer: `hooks/useEventData.js` is the one persistence hook.**
- Every collection is a table `(id, event_id, data jsonb, created_at, updated_at)`. Items are `data` plus `_rowId`, `_createdAt`, `_updatedAt` (stripped before save). Collections: households, people, expenses, vendors, tasks, prep, tables, gifts, favors, seating, ceremony_roles, dayof. Event-level settings live in `events.admin_config` (jsonb: `timeline`, `visibleTabs`, `theme`, `favorConfig`, `guestWelcomeNote`, ...).
- Writes go through `save()` or the `saveUndoable` / `saveManyUndoable` / `removeUndoable` / `removeManyUndoable` helpers. Existing rows save through the `save_row` RPC with optimistic concurrency on `_updatedAt`, so callers must pass the item with `_updatedAt` intact and handle `{conflict}`. A direct `supabase.from(...)` write bypasses concurrency, the audit log and the sync indicator. Undo never overwrites a co-planner's newer edit; `utils/undo.js` `toastUndo` shows the toast.
- Realtime is an enhancement over the initial fetch (which is the source of truth). The channel name includes a per-instance random id; keep it, because two hooks on one collection used to collide. Any new table must be added to the Realtime publication.
- `status`, `group_name`, `out_of_town` on households/people are promoted columns derived from the jsonb; never write them directly. Household RSVP lives in `rsvpStatus` (the legacy `status` key is self-healed on load).
- `components/AdminPanel.jsx` hardcodes `COLLECTIONS` lists (around lines 238 and 310) used for wipe and restore. Update them when adding a collection.
- Legacy shapes are read-adapted, with no migration (single-giver gifts, expense `paid`, city/state/zip); they upgrade on the next save.

**Domain rules live in pure helpers in `utils/`. Import them; never re-derive.**
- **Sub-events and guest counts: `utils/sections.js` is the single source.** `person.sectionRsvp` (Yes / No / absent = TBD) must only be read via `getPersonSectionStatus`, and invitation only via `isInvited(hh, section)` (a household is invited if `invitedSections` includes it or `inviteAllByDefault !== false`). Overview, Day-of and exports each once re-derived a wrong count. Metric definitions (Total Guests, Confirmed, Awaiting, Expected) are written once in `constants/metrics.js`. Awaiting is computed directly, not by subtraction (it can go negative otherwise). Counts switch to "precise mode" once any timeline entry has `servesMeal`; before that they follow household `rsvpStatus`.
- **Mirrored logic that must change together:** `isInvited` in `utils/sections.js` ↔ `api/_lib/rsvp-shared.js`; `buildCalendarEvents` in `utils/calendar.js` ↔ `api/_lib/calendar-subscribe.js`; `computeSuggestions` in `utils/tasks.js` ↔ `computeFocusItems` in `utils/focus.js`.
- **RSVP replies:** `utils/rsvpApply.js` (pure) plans what accepting a reply writes and builds the undo snapshot stored in `rsvp_replies.applied_snapshot`. In replies, `personId` and `household_id` are table row ids (`_rowId`), not the ids inside `data`. `components/guests/ReplyQueue.jsx` does the saving.
- Budget: `utils/expensePayments.js` (`expense.amount` is always the contract total, `payments[]` the schedule) and `utils/vendors.js`. Seating: `utils/seating.js` (seats are per sub-event via `person.tableAssignments[sectionId]`). Gifts: `utils/gifts.js` (`givers[]`, `items[]` is the source of truth, thank-yous counted per giver). Guest import: `utils/guests.js` parse + `utils/guestImport.js` write. Setup checklist: `utils/setupState.js`. Print brief: `utils/dayofBrief.js` via `utils/printDocument.js` (injects `#print-root`, no iframe).
- Favors have no util file; the logic is inside `FavorsTab.jsx`.
- Tab-to-tab navigation with a filter uses one-shot in-memory presets (`guestsPreset`, `giftsPreset`, `calendarFocus`) consumed on tab open.

**Theming and UI patterns.** 9 palettes in `constants/theme.js`; `ThemeProvider` injects `--accent-*` variables. `styles/palette-tokens.css` is **generated**; never hand-edit. Dark mode is `data-theme` on `<html>` (`hooks/useDarkMode.js`). `src-v3/App.css` imports `styles/` in cascade order; **do not reorder**. Bulk selection is `hooks/useBulkSelection.js` + `components/shared/BulkBar` (Gifts and Tasks). "New" pills are registered in `constants/newFeatures.js`; "What's new" is `lib/whatsNew.js` reading static `/whats-new/*.json`, with `data-wn-focus="..."` attributes as "Show me" targets.

## Guest RSVP site and messaging

- `src-v3/rsvp/` talks only to `/api/rsvp` and never to Supabase. The private token travels in the `X-RSVP-Token` header, never in a URL. Replies insert a `pending` row in `rsvp_replies` for the host to review in the Guests tab; nothing auto-applies. Replies are blocked (409) for archived events and after the deadline.
- `buildInfo` / `stripHostOnly` / `HOST_ONLY_TIMELINE_FIELDS` in `api/_lib/rsvp-shared.js` decide what a guest sees: only invited sub-events, only hotels flagged `shareWithGuests`, https links only, host-only timeline fields (audience, arriveBy, room, address) never. Run `check-guest-strip.mjs` after touching it.
- Guest email is `POST /api/guest?action=send` (`_lib/guest-send.js`): requires owner/editor JWT, resolves households server-side, skips missing/invalid/opted-out emails, rate-limited from `message_log` (5/min, 2000 recipients/day per event). `dry_run` previews; `action=test` sends one sample to the caller. Unsubscribe links are HMAC-signed with `GUEST_UNSUBSCRIBE_SECRET`; the GET confirmation page changes nothing, POST sets `households.email_opt_out`.
- RSVP rate limiting is in-memory per serverless instance, so it is not global.

## Serverless API (`client/api/`)

Vercel Hobby allows **12 functions per deployment**. Files directly under `api/` are routers that dispatch on `?action=` through a whitelist of lazy imports (`invites`, `billing`, `calendar`, `admin`, `system`, `guest`, `rsvp`), plus `stripe-webhook.js` (raw body + signature) and `cron/lifecycle-emails.js`. **Add an endpoint as an action on a router with its code in `api/_lib/`; never add a new file under `api/`.** Legacy URLs like `/api/accept-invite` are rewritten to routers in both `vercel.json` and `vercel.admin.json`; keep those rewrites above the `/api/:path*` catch-all.

Auth differs per handler (JWT + owner/editor check, `admin_users`, HMAC, guest token, `CRON_SECRET`, Stripe signature). Handlers that act as a signed-in user call `authenticate(req)` from `api/_lib/auth.js` (validates the `Authorization: Bearer` token and returns `{ user, supabase }`). A new endpoint must do the same, and must never trust a user id or email from the request body; the frontend sends the token with `authJsonHeaders()` from `utils/authHeaders.js`. The deliberate exceptions are the guest-token RSVP routes, HMAC unsubscribe, the token-gated calendar feed, and `notify` with type `client_error` (clipped and rate limited).

Billing: one purchase per event. "Paid" is a completed `purchases` row (there is no `events.paid` column); the picker polls for it after Stripe returns, then `stampPurchase` links it to the new event. `archived` (bool on `events`) makes RLS writes read-only and blocks guest sends and RSVP replies. Refunding a purchase in the admin console (`refund_purchase`) archives its event, and the `V5.14.1-L1.sql` trigger stops the owner unarchiving it; it does not return money, so also refund in Stripe. Hardcoded values to remember: the price is `STRIPE_PRICE_REGULAR` with `BASE_PRICE` (cents) in `create-checkout-session.js`, the app origin `https://app.simcha-kit.com` in guest email and RSVP code, and Brevo template/list ids in `invites`, `brevo-sync` and the lifecycle cron.

`GET /api/admin?action=metrics-summary` (bearer `METRICS_READ_TOKEN`) returns counts only for the planning agents; keep it free of names, emails and guest data. First-touch campaign tags are captured in `src-v3/utils/attribution.js` and saved to `user_profiles.signup_source`; the optional "how did you hear" answer is `user_profiles.heard_from`. The planning agents' operating model is `docs/AGENT_TEAM.md`, with audience and tone in `docs/PRODUCT.md`.

The demo event (`440a8b9e-e92e-4ad6-b352-41965bd8383b`, seed in `_lib/demo-seed.js`) is reset daily by `.github/workflows/reset-demo.yml`.

Env vars (Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `GUEST_MAIL_FROM`, `GUEST_UNSUBSCRIBE_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_EMAIL_TO`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_REGULAR`, `VITE_APP_URL`, `CRON_SECRET`, `ADMIN_RESET_TOKEN`, `METRICS_READ_TOKEN`.

## Database changes

No ORM or migration runner. SQL goes in `client/migrations/` (one idempotent file per milestone, e.g. `V5.3-O3.sql`, starting with a note on its RLS impact). The user pastes it into the Supabase SQL editor by hand, usually **before** deploying the code that needs it, so say which migration must run first. Rules that have caused failures:

- Any function referenced inside an RLS policy needs `EXECUTE` granted to `anon`, even if anon never calls it. Failure shows up as a table access error, not a function error.
- `CREATE OR REPLACE FUNCTION` drops existing grants, so re-run `GRANT EXECUTE` afterwards.
- The demo event has hardcoded `anon` policies on every collection table. A new table needs matching Demo read and write policies if the demo site must use it.

## Releases and changelog

Every shipped change includes its changelog work in the same change, not as a follow-up:

1. `client/changelog/entries.json`: the host-facing "What's new". Entries need `release`, `kind`, `area`, `audience`, `title` and (for highlights) `body`; at most 3 highlights per month; no version numbers, table names, endpoints or "migration/RLS" in the text. The build rejects violations. Full rules in `client/changelog/README.md`.
2. Root `changelog.json`: developer history. Add a new top entry **and** bump `current`. `.github/workflows/release.yml` creates the GitHub release from it on merge to `main` and fails if `current` doesn't match the first entry. Never delete it. `client/changelog/dev.json` holds the older archive and dev-only notes.

`client/public/changelog.json` is frozen for old cached clients; don't edit it. Rebuild with `node scripts/build-changelog.mjs` after editing.

## Working conventions

- Commit messages name the release and milestone, e.g. `V5.14.0: Guest event page after RSVP ... (V5-G1)`. Work happens on a feature branch and goes through a GitHub PR to `main` (`gh` is not installed on this NAS).
- The user is new to Git. When a change is ready, give explicit `git add <named files>`, `git commit -m` and `git push -u origin <branch>` commands, each in its own bash block, then the PR step. Never use `git add .`: the working tree holds many unrelated modified files (`@eaDir`, V2 `client/src`, `public/`).
