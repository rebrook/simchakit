-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.3 (O3) — Overview rebuild: a preferred name for the greeting
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. user_profiles.preferred_name is a new column on an existing table, so the table's
--   existing row policies apply unchanged: each user can read and update only their own row
--   (the app already updates display_name that way). No policy is added or widened and anon
--   has no access.
--
-- DATA IMPACT
--   No backfill. Existing rows get NULL, and the app greets those users with "Welcome back."
--   display_name is untouched and keeps driving sender names and messages.
--
-- The new timeline-entry fields (audience, arriveBy, room, address) live in
-- events.admin_config.timeline (jsonb), so they need no migration.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_name text;

-- Smoke test (run after the migration)
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'user_profiles' AND column_name = 'preferred_name';
