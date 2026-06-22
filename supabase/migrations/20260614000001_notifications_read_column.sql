-- Add read column to notifications if missing
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

-- Make sure update policy exists so users can mark as read
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure insert is open (for admin broadcast)
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Ensure select works
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
