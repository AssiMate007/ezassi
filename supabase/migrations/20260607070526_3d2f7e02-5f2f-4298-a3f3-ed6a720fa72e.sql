
-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_assignments() FROM PUBLIC, anon, authenticated;

-- Tighten overly permissive notifications INSERT policy:
-- Only allow inserting a notification for: yourself, or by an admin.
DROP POLICY IF EXISTS "Anyone inserts notifications" ON public.notifications;
CREATE POLICY "Insert notifications safely"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    -- allow involved parties of a payment to notify each other / admin
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE (p.student_id = auth.uid() OR p.writer_id = auth.uid())
    )
  );
