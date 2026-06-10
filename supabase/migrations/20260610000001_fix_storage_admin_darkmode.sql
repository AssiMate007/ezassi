-- ============================================================
-- FIX 1: Storage policies — remove has_role() from storage
-- (storage engine can't call security-definer functions)
-- ============================================================

-- Drop old broken policies
DROP POLICY IF EXISTS "Writers upload own folder"   ON storage.objects;
DROP POLICY IF EXISTS "Writers read own files"      ON storage.objects;
DROP POLICY IF EXISTS "Admin reads all files"       ON storage.objects;
DROP POLICY IF EXISTS "Students read released files" ON storage.objects;
DROP POLICY IF EXISTS "Writers update own files"    ON storage.objects;
DROP POLICY IF EXISTS "Admin uploads files"         ON storage.objects;

-- Writers: upload into their own uid folder
CREATE POLICY "Writers upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Writers: read their own folder
CREATE POLICY "Writers read own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Writers: overwrite (upsert) their own files
CREATE POLICY "Writers update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Students: read released files for their assignments
CREATE POLICY "Students read released files"
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

-- Students: upload payment screenshots into their own folder
CREATE POLICY "Students upload screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admin: read ALL files in bucket (no has_role — use direct join)
CREATE POLICY "Admin reads all files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- FIX 2: user_roles INSERT policy so admin self-heal works
-- ============================================================
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
CREATE POLICY "Users insert own role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FIX 3: payments — allow student to update screenshot_url
-- regardless of current status (was blocked after first update)
-- ============================================================
DROP POLICY IF EXISTS "Student uploads screenshot" ON public.payments;
CREATE POLICY "Student uploads screenshot" ON public.payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ============================================================
-- FIX 4: Guarantee admin row for owner
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIX 5: is_banned column
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
