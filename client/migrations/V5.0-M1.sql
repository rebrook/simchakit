-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.0 (M1) — Guest messaging: data model
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   * message_log, message_recipients: new tables, RLS enabled. No anon policies.
--     Read: event owner, plus editors and viewers who have accepted. Ritual
--     coordinators are deliberately excluded (their role is limited to Ceremony
--     and Prep). Write: owner and editors only, and never on archived events.
--     The send function writes with the service role (bypasses RLS) after its
--     own owner/editor check, so these write policies are defense in depth.
--   * events.message_settings: new nullable-by-default jsonb column. Existing
--     events.* policies already cover it; no policy change.
--   * households.email_opt_out: new boolean, default false. Existing households
--     policies already cover it; no policy change. No backfill needed: every
--     existing household reads as opted in.
--   * No Demo-event anon policies are added (guests/messaging are not part of
--     the demo).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columns on existing tables ----------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS message_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Shape: { "senderName": text, "replyTo": text, "footerText": text }
-- Empty object = defaults (sender = event name, reply-to = owner email, no footer).

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false;

-- 2. message_log ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind             text NOT NULL
                     CHECK (kind IN ('save_the_date','invitation','rsvp_reminder','thank_you','custom')),
  subject          text NOT NULL,
  body_snapshot    text NOT NULL,            -- the template as sent, before merge
  sent_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  recipient_count  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS message_log_event_sent_idx ON message_log (event_id, sent_at DESC);

-- 3. message_recipients ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_recipients (
  message_id    uuid NOT NULL REFERENCES message_log(id) ON DELETE CASCADE,
  household_id  text NOT NULL,               -- households.id is text ("hh_...")
  email         text NOT NULL,
  status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sent','failed','bounced')),
  error         text,
  provider_id   text,                        -- Brevo messageId
  PRIMARY KEY (message_id, household_id)
);
CREATE INDEX IF NOT EXISTS message_recipients_household_idx ON message_recipients (household_id);

-- 4. RLS -------------------------------------------------------------------------
ALTER TABLE message_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;

-- Helpers inline as EXISTS so no function grants are needed.
DROP POLICY IF EXISTS message_log_read ON message_log;
CREATE POLICY message_log_read ON message_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = message_log.event_id AND e.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM event_collaborators c
             WHERE c.event_id = message_log.event_id AND c.user_id = auth.uid()
               AND c.accepted_at IS NOT NULL AND c.role IN ('editor','viewer'))
);

DROP POLICY IF EXISTS message_log_write ON message_log;
CREATE POLICY message_log_write ON message_log FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = message_log.event_id AND NOT e.archived AND (
    e.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM event_collaborators c
               WHERE c.event_id = e.id AND c.user_id = auth.uid()
                 AND c.accepted_at IS NOT NULL AND c.role = 'editor')))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM events e WHERE e.id = message_log.event_id AND NOT e.archived AND (
    e.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM event_collaborators c
               WHERE c.event_id = e.id AND c.user_id = auth.uid()
                 AND c.accepted_at IS NOT NULL AND c.role = 'editor')))
);

DROP POLICY IF EXISTS message_recipients_read ON message_recipients;
CREATE POLICY message_recipients_read ON message_recipients FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM message_log m WHERE m.id = message_recipients.message_id AND (
    EXISTS (SELECT 1 FROM events e WHERE e.id = m.event_id AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM event_collaborators c
               WHERE c.event_id = m.event_id AND c.user_id = auth.uid()
                 AND c.accepted_at IS NOT NULL AND c.role IN ('editor','viewer'))))
);

DROP POLICY IF EXISTS message_recipients_write ON message_recipients;
CREATE POLICY message_recipients_write ON message_recipients FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM message_log m JOIN events e ON e.id = m.event_id
          WHERE m.id = message_recipients.message_id AND NOT e.archived AND (
            e.owner_id = auth.uid()
            OR EXISTS (SELECT 1 FROM event_collaborators c
                       WHERE c.event_id = e.id AND c.user_id = auth.uid()
                         AND c.accepted_at IS NOT NULL AND c.role = 'editor')))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM message_log m JOIN events e ON e.id = m.event_id
          WHERE m.id = message_recipients.message_id AND NOT e.archived AND (
            e.owner_id = auth.uid()
            OR EXISTS (SELECT 1 FROM event_collaborators c
                       WHERE c.event_id = e.id AND c.user_id = auth.uid()
                         AND c.accepted_at IS NOT NULL AND c.role = 'editor')))
);

-- 5. Smoke tests (run after the migration) -------------------------------------
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE (table_name = 'events' AND column_name = 'message_settings')
--      OR (table_name = 'households' AND column_name = 'email_opt_out');
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('message_log','message_recipients');
-- SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('message_log','message_recipients');
-- SELECT count(*) FROM households WHERE email_opt_out;   -- expect 0
