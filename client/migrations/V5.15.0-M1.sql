-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.15.0 (M1) — Measure where signups come from
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. user_profiles.signup_source (jsonb) and user_profiles.heard_from (text) are new columns on
--   an existing table, so the table's existing row policies apply unchanged: each user can read and
--   update only their own row (the app already updates display_name and preferred_name that way).
--   No policy is added or widened and anon has no access.
--
-- DATA IMPACT
--   No backfill. NULL means "not captured" (every account created before this release).
--   signup_source holds the first-touch campaign tags the person arrived with, for example
--   {"source":"facebook","medium":"social","campaign":"nov-guests","referrer":"l.facebook.com",
--    "landing":"/","at":"2026-11-04T15:00:00Z"}. heard_from holds the optional answer from the
--   first-event setup step: friend, synagogue, facebook, instagram, search, ai, vendor or other.
--   Neither column holds guest data. The privacy policy lists both.
--
-- Run this before deploying the code that writes these columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS signup_source jsonb,
  ADD COLUMN IF NOT EXISTS heard_from    text;

-- Smoke test (run after the migration)
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'user_profiles' AND column_name IN ('signup_source', 'heard_from');
