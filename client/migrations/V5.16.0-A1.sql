-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.16.0 (A1) — Weekly briefing for the admin console
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   Two new tables, both with row level security on and no access for anon.
--     agent_digests   signed-in users listed in admin_users can SELECT. Nobody can write from the
--                     browser; the weekly digest is written by the server (service role) only.
--     agent_decisions signed-in users listed in admin_users can SELECT and INSERT. There is no UPDATE
--                     or DELETE policy: a changed decision is a new row, so history is kept. The
--                     decided_by column must equal the caller's own id.
--   The policies read admin_users with an inline subquery (no function), so no EXECUTE grant to anon
--   is needed. Any other signed-in user, and anon, gets zero rows and cannot insert.
--   No Realtime publication and no Demo-event policies, on purpose.
--
-- DATA IMPACT
--   New empty tables. Nothing existing changes. The digest holds the planning agents' weekly
--   proposals and numbers (no guest data, no emails).
--
-- Run this BEFORE deploying the code that reads or writes these tables.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_digests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of       date        NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  fact_checked  boolean     NOT NULL DEFAULT false,
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id   uuid        NOT NULL REFERENCES public.agent_digests(id) ON DELETE CASCADE,
  item_no     integer     NOT NULL,
  title       text        NOT NULL DEFAULT '',
  decision    text        NOT NULL CHECK (decision IN ('approved', 'rejected', 'deferred')),
  reason      text,
  decided_at  timestamptz NOT NULL DEFAULT now(),
  decided_by  uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS agent_decisions_digest_idx
  ON public.agent_decisions (digest_id, item_no, decided_at DESC);

ALTER TABLE public.agent_digests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_digests   FROM anon, authenticated;
REVOKE ALL ON public.agent_decisions FROM anon, authenticated;
GRANT SELECT          ON public.agent_digests   TO authenticated;
GRANT SELECT, INSERT  ON public.agent_decisions TO authenticated;

DROP POLICY IF EXISTS "agent_digests admin read" ON public.agent_digests;
CREATE POLICY "agent_digests admin read" ON public.agent_digests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "agent_decisions admin read" ON public.agent_decisions;
CREATE POLICY "agent_decisions admin read" ON public.agent_decisions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "agent_decisions admin insert" ON public.agent_decisions;
CREATE POLICY "agent_decisions admin insert" ON public.agent_decisions
  FOR INSERT TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid())
  );
