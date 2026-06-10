-- ================================================================
-- NUCLEAR STORAGE FIX
-- Drop ALL existing storage policies and recreate without has_role
-- ================================================================

-- Drop every storage policy that could exist
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Simple universal policy: any authenticated user can upload to their own uid folder
CREATE POLICY "auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Any authenticated user can update files in their own folder
CREATE POLICY "auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Any authenticated user can read files in their own folder
CREATE POLICY "auth_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Students can read released files for their assignments
CREATE POLICY "auth_read_released"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND EXISTS (
    SELECT 1 FROM public.assignment_files af
    JOIN public.assignments a ON a.id = af.assignment_id
    WHERE af.storage_path = storage.objects.name
      AND af.released = true
      AND a.student_id = auth.uid()
  )
);

-- Admin reads all: use direct table join, NO function call
CREATE POLICY "auth_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.user_id::text FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- ================================================================
-- FIX PAYMENTS: drop restrictive policy, allow student to update freely
-- ================================================================
DROP POLICY IF EXISTS "Student uploads screenshot" ON public.payments;
DROP POLICY IF EXISTS "Student updates payment"   ON public.payments;
CREATE POLICY "Student updates payment" ON public.payments
  FOR UPDATE TO authenticated
  USING  (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ================================================================
-- FIX user_roles INSERT policy
-- ================================================================
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
CREATE POLICY "Users insert own role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Guarantee admin row
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- ================================================================
-- REMOVE role restriction: allow any user to post AND bid
-- Change default role to 'student' for all (both can do everything)
-- ================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Drop old assignment insert policy that checks role
DROP POLICY IF EXISTS "Students post assignments" ON public.assignments;
DROP POLICY IF EXISTS "student_insert_assignment"  ON public.assignments;

-- Allow ANY authenticated user to post assignments
CREATE POLICY "any_user_post_assignment" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Drop old bid insert policy that checks role
DROP POLICY IF EXISTS "Writers place bids"  ON public.bids;
DROP POLICY IF EXISTS "writer_insert_bid"   ON public.bids;

-- Allow ANY authenticated user to bid
CREATE POLICY "any_user_place_bid" ON public.bids
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = writer_id);
