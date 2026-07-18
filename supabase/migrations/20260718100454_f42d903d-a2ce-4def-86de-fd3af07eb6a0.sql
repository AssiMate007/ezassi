
-- 1. user_roles: prevent self-escalation
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_self" ON public.user_roles;
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 2. notifications: remove permissive true policies
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_anyone" ON public.notifications;
CREATE POLICY "notif_insert_scoped" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = notifications.user_id AND ur.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      LEFT JOIN public.bids b ON b.assignment_id = a.id
      WHERE (a.student_id = auth.uid() OR b.writer_id = auth.uid())
        AND (a.student_id = notifications.user_id OR b.writer_id = notifications.user_id)
    )
    OR public.is_admin()
  );

-- 3. bids: restrict SELECT to involved parties + admin
DROP POLICY IF EXISTS "bid_select" ON public.bids;
DROP POLICY IF EXISTS "bids_select" ON public.bids;
CREATE POLICY "bids_select_scoped" ON public.bids
  FOR SELECT TO authenticated
  USING (
    auth.uid() = writer_id
    OR auth.uid() = (SELECT student_id FROM public.assignments WHERE id = bids.assignment_id)
    OR public.is_admin()
  );

-- 4. Move upi_id out of profiles into a private payout table
CREATE TABLE IF NOT EXISTS public.user_payout_info (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  upi_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payout_info TO authenticated;
GRANT ALL ON public.user_payout_info TO service_role;
ALTER TABLE public.user_payout_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_own_all" ON public.user_payout_info;
CREATE POLICY "payout_own_all" ON public.user_payout_info
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payout_admin_select" ON public.user_payout_info;
CREATE POLICY "payout_admin_select" ON public.user_payout_info
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "payout_student_select" ON public.user_payout_info;
CREATE POLICY "payout_student_select" ON public.user_payout_info
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.writer_id = user_payout_info.user_id
        AND p.student_id = auth.uid()
    )
  );

INSERT INTO public.user_payout_info (user_id, upi_id)
  SELECT id, upi_id FROM public.profiles WHERE upi_id IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS upi_id;

-- 5. assignment_files: prevent bid squatting
DROP POLICY IF EXISTS "afile_insert" ON public.assignment_files;
DROP POLICY IF EXISTS "afiles_insert" ON public.assignment_files;
CREATE POLICY "afiles_insert_own_accepted_bid" ON public.assignment_files
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = writer_id
    AND EXISTS (
      SELECT 1 FROM public.bids
      WHERE id = bid_id AND writer_id = auth.uid() AND status = 'accepted'
    )
  );

-- 6. messages: drop any legacy permissive insert
DROP POLICY IF EXISTS "Sender inserts messages" ON public.messages;

-- 7. payments: server-side enforcement of commission and payout
CREATE OR REPLACE FUNCTION public.enforce_payment_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.commission := ROUND(NEW.amount * 0.15);
  NEW.writer_payout := NEW.amount - NEW.commission;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_commission_trigger ON public.payments;
CREATE TRIGGER enforce_payment_commission_trigger
  BEFORE INSERT OR UPDATE OF amount ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_commission();

-- 8. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.submit_writer_rating(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_writer_rating(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_writer_rating(uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.purge_expired_assignments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_assignments() FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_assignments() FROM authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM authenticated;
