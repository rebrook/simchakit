-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.1 (R3) — RSVP review queue: undo snapshot, review fields, live updates
-- Run in the Supabase SQL editor AFTER V5.1-R1.sql. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. All four columns are added to rsvp_replies, whose policies from V5.1-R1
--   already apply (read: owner, editors, viewers; update and delete: owner and editors,
--   never on archived events; no insert policy, since only api/rsvp.js inserts, with the
--   service role; anon has no access). The review queue updates replies from the
--   browser under those policies. Adding the table to the realtime publication does not
--   widen access: realtime delivers a row only to people who could select it.
--
-- DATA IMPACT
--   No backfill: existing replies simply have these columns empty.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rsvp_replies
  ADD COLUMN IF NOT EXISTS applied_snapshot jsonb,       -- the values an accept replaced, so Undo can restore them exactly
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason    text;

-- New replies appear in the Guests tab without a refresh.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rsvp_replies') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rsvp_replies;
  END IF;
END $$;

-- Smoke tests (run after the migration)
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'rsvp_replies' AND column_name IN ('applied_snapshot', 'reviewed_by', 'reviewed_at', 'reject_reason');
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rsvp_replies';
