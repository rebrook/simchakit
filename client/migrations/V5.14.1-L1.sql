-- ─────────────────────────────────────────────────────────────────────────────
-- SimchaKit V5.14.1 (L1) — Lock an event when its purchase is refunded
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- RLS IMPACT
--   None. No policy is added or widened. A trigger on events stops a signed-in user (role
--   authenticated or anon) from setting archived back to false while any purchase for that event
--   is refunded. The service role and the SQL editor are not blocked, so an admin can still
--   unarchive on purpose.
--
-- DATA IMPACT
--   No backfill. Events whose purchase was refunded before this migration are not changed; the
--   refund action in the admin console archives the event going forward.
--
-- Run this before deploying the code that archives on refund (admin-query refund_purchase).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_unarchive_refunded()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.archived IS TRUE
     AND NEW.archived IS NOT TRUE
     AND COALESCE(auth.role(), '') IN ('authenticated', 'anon')
     AND EXISTS (
       SELECT 1 FROM purchases p
       WHERE p.event_id = OLD.id AND p.status = 'refunded'
     )
  THEN
    RAISE EXCEPTION 'This event was locked because its purchase was refunded. Contact hello@simcha-kit.com.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_prevent_unarchive_refunded ON events;
CREATE TRIGGER events_prevent_unarchive_refunded
  BEFORE UPDATE OF archived ON events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unarchive_refunded();

-- Smoke test (run after the migration)
-- SELECT tgname FROM pg_trigger WHERE tgname = 'events_prevent_unarchive_refunded';
