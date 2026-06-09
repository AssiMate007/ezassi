-- =========================================================
-- DEMO ACCOUNTS + BUG FIXES
-- =========================================================

-- 1. Add is_banned column if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- 2. Demo accounts via Supabase auth.users
-- NOTE: Supabase doesn't allow direct password insertion via SQL.
-- Instead we create profile rows here; passwords are set via the
-- Supabase dashboard → Authentication → Users → "Add user":
--   student@assimate.demo  / Demo@12345
--   writer@assimate.demo   / Demo@12345

-- We insert placeholder profile rows that will be linked
-- when the users sign up with those emails via the auth page.
-- The trigger handle_new_user_role will auto-assign their role.

-- 3. Ensure admin role for owner (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- 4. Fix: ensure user_roles has correct RLS so admin can self-insert
-- Allow authenticated users to insert their own role (for admin auto-heal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles' AND policyname = 'Users insert own role'
  ) THEN
    CREATE POLICY "Users insert own role" ON public.user_roles
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Seed a demo open assignment (only if demo student exists)
DO $$
DECLARE
  student_uid uuid;
  writer_uid  uuid;
BEGIN
  SELECT id INTO student_uid FROM auth.users WHERE email = 'student@assimate.demo' LIMIT 1;
  SELECT id INTO writer_uid  FROM auth.users WHERE email = 'writer@assimate.demo'  LIMIT 1;

  IF student_uid IS NOT NULL THEN
    -- Seed profile for student if missing
    INSERT INTO public.profiles (id, display_name, role, rating, jobs_completed)
    VALUES (student_uid, 'Demo Student', 'student', 0, 0)
    ON CONFLICT (id) DO NOTHING;

    -- Seed a demo assignment
    INSERT INTO public.assignments (student_id, title, description, subject, budget_min, budget_max, deadline, status)
    VALUES (
      student_uid,
      'Help with Class 10 Algebra worksheet',
      'I need help solving 20 algebra problems from my textbook. Topics: linear equations, quadratic equations, and polynomials. Please show all steps clearly.',
      'Math',
      150,
      400,
      NOW() + INTERVAL '3 days',
      'open'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF writer_uid IS NOT NULL THEN
    -- Seed profile for writer if missing
    INSERT INTO public.profiles (id, display_name, role, rating, jobs_completed)
    VALUES (writer_uid, 'Demo Writer', 'writer', 4.8, 12)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
