-- Drop all existing storage policies cleanly
DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload"    ON storage.objects;
DROP POLICY IF EXISTS "auth_update"    ON storage.objects;
DROP POLICY IF EXISTS "auth_read_own"  ON storage.objects;

-- INSERT: any authenticated user can upload to their own uid/ folder
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: any authenticated user can update files in their own uid/ folder
CREATE POLICY "storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: own files OR admin OR student downloading their released file
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (
      -- own folder
      (storage.foldername(name))[1] = auth.uid()::text
      -- admin can read everything
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      -- student can read their released assignment file
      OR EXISTS (
        SELECT 1 FROM public.assignment_files af
        JOIN public.assignments a ON a.id = af.assignment_id
        WHERE af.storage_path = storage.objects.name
          AND af.released = true
          AND a.student_id = auth.uid()
      )
    )
  );

-- DELETE: admin only (for rejecting files)
DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
