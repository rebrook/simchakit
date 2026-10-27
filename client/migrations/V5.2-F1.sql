-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.2 (F1) — First run: setup progress saved on the event
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. events.setup_state is a column on an existing table, so the existing events
--   policies already apply: the owner and accepted editors can update it (never on
--   archived events); viewers and coordinators cannot write it; anon has no access.
--   Everyone who can read the event can read it, which is what lets co-planners see
--   the same checklist state. No new policy, no change to who can read or write.
--
-- DATA IMPACT
--   No backfill. Existing events get '{}' (nothing recorded), and the app treats that
--   as "derive each step from the event's own data" (guests added, timeline, logo...),
--   so existing events and guests load unchanged.
--
-- setup_state shape (all optional):
--   { "steps": { "<stepId>": "done" | "skipped" },   -- stepIds: events-venue, guests, coplanner, look
--     "dismissed": true | false,                    -- the host closed the Getting ready card
--     "legacyChecked": true }                       -- the old localStorage dismissal was migrated
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS setup_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Smoke test (run after the migration)
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name = 'events' AND column_name = 'setup_state';
