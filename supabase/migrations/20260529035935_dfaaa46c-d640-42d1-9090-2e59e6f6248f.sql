
-- Auto-purge assignments after their deadline passes
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_expired_assignments()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.messages
   WHERE assignment_id IN (SELECT id FROM public.assignments WHERE deadline < now());
  DELETE FROM public.bids
   WHERE assignment_id IN (SELECT id FROM public.assignments WHERE deadline < now());
  DELETE FROM public.assignments WHERE deadline < now();
$$;

SELECT cron.schedule(
  'purge-expired-assignments',
  '*/15 * * * *',
  $$ SELECT public.purge_expired_assignments(); $$
);
