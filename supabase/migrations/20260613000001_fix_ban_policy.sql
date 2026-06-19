-- Ensure ban/unban works: drop the old restrictive policy that only allowed
-- self-updates, keep only the combined self-or-admin policy

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;

CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Guarantee admin row exists (idempotent safety net)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
