# Release notes: how to write them

`entries.json` is the one source of truth for what hosts see in **What's new** and the **release archive**.
`dev.json` and this file hold everything developers need (migrations, row-level security, environment
variables, endpoints, refactors, the old roadmap and known issues). Nothing in `dev.json` is ever shipped.

`node scripts/build-changelog.mjs` (it also runs on every `vite build --config vite.config.v3.js`) turns
`entries.json` into `public/whats-new/index.json` and `public/whats-new/YYYY-MM.json`, and **fails the build**
when a rule below is broken.

## Entry shape

```json
{
  "id": "2026-10-27-01-celebration-schedule",
  "date": "2026-10-27",
  "kind": "new",
  "area": "Overview",
  "audience": "host",
  "highlight": true,
  "title": "See your whole weekend on the Overview",
  "body": "One or two sentences. Highlights only.",
  "show": { "tab": "overview", "focus": "celebration-schedule" },
  "guide": "getting-started/how-simchakit-works"
}
```

- `id`: `YYYY-MM-DD-NN-slug`. The `NN` counts up through the day, so ids sort oldest to newest. A person has "seen" every id up to and including their `last_seen_release`.
- `kind`: `new`, `improved` or `fixed`.
- `area`: Overview, Guests, Messaging, Budget, Tasks, Gifts, Seating, Admin, Setup, Exports, All tabs.
- `audience`: `host` ships in the app. `dev` is never built into the app; prefer to write developer detail in `dev.json` or this folder instead.
- `show`: `tab` is a tab id; `focus` is the value of a `data-wn-focus="..."` attribute on the feature (add the attribute when you add a highlight).
- `guide`: optional `sectionId/topic-slug` from the in-app guide. Opens `#/guide/section/topic`.

## Authoring checklist

1. Begin with what the host can now do ("Remind only the households still waiting"), not with the feature name.
2. One sentence, plain words.
3. No version numbers, table names, endpoints, "migration", "RLS" or "API". The build rejects them.
4. Use **Fixed** only for something a host would have noticed.
5. A highlight is a benefit, not a feature name. It needs a `body` (one or two sentences).
6. At most three highlights per month. The build rejects a fourth.
7. Never promise roadmap items. The roadmap and known-issues lists are dev-only and are not in the host files.
8. Check dark mode, and the filled "Show me" button in two palettes, before shipping a highlight.

## New-pill (one-time "New" label on a feature)

Add `{ key, area, since }` to `src-v3/constants/newFeatures.js`. It shows for 14 days after `since`, or until the
person opens that feature, remembered per browser in `localStorage` under `simchakit.newSeen`.

## Developer notes

Anything a developer needs about a release goes here or in `dev.json`, for example:

- V5.4-W1: `client/migrations/V5.4-W1.sql` adds `user_profiles.last_seen_release` (nullable text). No policy change; each user reads and updates only their own row. No backfill: NULL means "never opened". A brand-new account is set to the current release on first load.
- The pre-V5.4 `public/changelog.json` is frozen so cached older clients still load. Delete it once old clients have aged out.
- `scripts/convert-changelog-once.mjs` was the one-time conversion from the old file. Host lines it kept are first sentences of the old lines and deserve an editorial pass.
