-- =====================================================
-- GUARANTEE admin row + allow self-insert for healing
-- =====================================================

-- 1. Add INSERT policy so admin can self-heal via the app
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles'
      AND policyname = 'Users insert own role'
  ) THEN
    CREATE POLICY "Users insert own role" ON public.user_roles
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Backfill admin for owner (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- 3. Add is_banned if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
