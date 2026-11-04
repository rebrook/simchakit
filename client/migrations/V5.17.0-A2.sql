-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.17.0 (A2) — Weekly briefing: answers, questions and the team's replies
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. Both tables keep their existing policies: admin_users can SELECT, and can INSERT decisions
--   with decided_by = their own id. No UPDATE or DELETE policy is added, and anon still has no access.
--   The new columns team_status, team_reply and picked_up_at are written only by the server (service
--   role). To keep the browser out of them, the INSERT grant on agent_decisions is narrowed to the
--   columns the console actually sends.
--
-- DATA IMPACT
--   Adds columns to agent_decisions (answers, team_status, team_reply, picked_up_at). Existing rows
--   are untouched. Widens the decision check to allow 'question'.
--
-- Run this BEFORE deploying the code that reads or writes these columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.agent_decisions ADD COLUMN IF NOT EXISTS answers      jsonb;
ALTER TABLE public.agent_decisions ADD COLUMN IF NOT EXISTS team_status  text;
ALTER TABLE public.agent_decisions ADD COLUMN IF NOT EXISTS team_reply   text;
ALTER TABLE public.agent_decisions ADD COLUMN IF NOT EXISTS picked_up_at timestamptz;

-- Replace the inline check on "decision" with one that also allows 'question'.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.agent_decisions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%decision%'
  LOOP
    EXECUTE format('ALTER TABLE public.agent_decisions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.agent_decisions
  ADD CONSTRAINT agent_decisions_decision_check
  CHECK (decision IN ('approved', 'rejected', 'deferred', 'question'));

-- Browser may insert only the columns it sends; the team columns stay server-only.
REVOKE INSERT ON public.agent_decisions FROM authenticated;
GRANT INSERT (digest_id, item_no, title, decision, reason, answers, decided_by)
  ON public.agent_decisions TO authenticated;
