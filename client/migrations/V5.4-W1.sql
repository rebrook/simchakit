-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.4 (W1) — What's new: remember the last release a person has seen
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. user_profiles.last_seen_release is a new column on an existing table, so the table's
--   existing row policies apply unchanged: each user can read and update only their own row
--   (the app already updates display_name and preferred_name that way). No policy is added or
--   widened and anon has no access.
--
-- DATA IMPACT
--   No backfill. NULL means "never opened What's new", and the app then shows the latest
--   highlights once. A brand-new account is set to the current release on first load by the
--   app, so it is never greeted by old news.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_release text;

-- Smoke test (run after the migration)
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_name = 'user_profiles' AND column_name = 'last_seen_release';
