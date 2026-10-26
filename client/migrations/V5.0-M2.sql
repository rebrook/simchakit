-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.0 (M2) — Guest messaging UI: manual "mark as sent" support
-- Run in the Supabase SQL editor AFTER V5.0-M1.sql. Safe to re-run (idempotent).
-- Do not edit V5.0-M1.sql; it is already applied.
--
-- RLS IMPACT
--   None. Both changes are column-level on tables M1 already protects. The
--   existing message_log / message_recipients policies (read: owner, editors,
--   viewers; write: owner and editors, never on archived events) cover the new
--   column and the nullable email. The app writes manual marks and undoes them
--   from the browser under those policies; no new function and no anon access.
--
-- DATA IMPACT
--   Existing rows read as channel = 'email'. No backfill.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. How a message reached the household: our email send, paper mail, or
--    another platform (Evite, Paperless Post, a printer, a calligrapher...).
ALTER TABLE message_log
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_log_channel_check') THEN
    ALTER TABLE message_log
      ADD CONSTRAINT message_log_channel_check CHECK (channel IN ('email', 'paper', 'external'));
  END IF;
END $$;

-- 2. Manual marks have no email address to record.
ALTER TABLE message_recipients ALTER COLUMN email DROP NOT NULL;

-- 3. Smoke tests (run after the migration)
-- SELECT column_name, is_nullable, column_default FROM information_schema.columns
--   WHERE (table_name = 'message_log' AND column_name = 'channel')
--      OR (table_name = 'message_recipients' AND column_name = 'email');
-- SELECT channel, count(*) FROM message_log GROUP BY channel;   -- existing rows: email
