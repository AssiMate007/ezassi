-- ================================================================
-- COMPLETE RESET — drops EVERY old policy by dynamic name, then
-- recreates clean policies WITHOUT has_role(), and guarantees the
-- 'assignment-files' storage bucket exists.
--
-- Run this whole file in Supabase SQL editor. Safe to re-run.
-- ================================================================

-- ----------------------------------------------------------------
-- 0. Make sure has_role function is grantable (some past migrations revoked it)
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 1. NUCLEAR drop — every policy on every table we care about
-- ----------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename IN (
        'profiles', 'user_roles', 'assignments', 'bids', 'payments',
        'assignment_files', 'notifications', 'chats', 'messages'))
       OR (schemaname = 'storage' AND tablename = 'objects')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- 2. is_banned column (idempotent)
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------
-- 3. PROFILES
-- ----------------------------------------------------------------
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);  -- public-ish so display names show in feeds/bids

CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------
-- 4. USER_ROLES
-- ----------------------------------------------------------------
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = auth.uid() AND ur2.role = 'admin'));

CREATE POLICY "user_roles_insert_self" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 5. ASSIGNMENTS
-- ----------------------------------------------------------------
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assignments_insert" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "assignments_update" ON public.assignments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------
-- 6. BIDS
-- ----------------------------------------------------------------
CREATE POLICY "bids_select" ON public.bids
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bids_insert" ON public.bids
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = writer_id);

CREATE POLICY "bids_update" ON public.bids
  FOR UPDATE TO authenticated
  USING (auth.uid() = writer_id
    OR auth.uid() = (SELECT student_id FROM public.assignments WHERE id = assignment_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------
-- 7. PAYMENTS
-- ----------------------------------------------------------------
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id
    OR auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------
-- 8. ASSIGNMENT_FILES — writer uploads, admin releases
-- ----------------------------------------------------------------
CREATE POLICY "afiles_select" ON public.assignment_files
  FOR SELECT TO authenticated
  USING (
    auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.assignments WHERE id = assignment_id AND student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "afiles_insert" ON public.assignment_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = writer_id);

CREATE POLICY "afiles_update" ON public.assignment_files
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = writer_id AND released = false)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "afiles_delete_admin" ON public.assignment_files
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------
-- 9. NOTIFICATIONS
-- ----------------------------------------------------------------
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_anyone" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 10. CHATS / MESSAGES  (only if tables exist — skip silently if not)
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chats') THEN
    EXECUTE 'CREATE POLICY "chats_select" ON public.chats FOR SELECT TO authenticated USING (auth.uid() = student_id OR auth.uid() = writer_id)';
    EXECUTE 'CREATE POLICY "chats_insert" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id OR auth.uid() = writer_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages') THEN
    EXECUTE 'CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id)';
    EXECUTE 'CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id)';
    EXECUTE 'CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id)';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 11. STORAGE BUCKET — create if missing, make private
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignment-files',
  'assignment-files',
  false,
  31457280,  -- 30 MB
  NULL       -- allow any mime, we sanitize on the client
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = GREATEST(storage.buckets.file_size_limit, 31457280);

-- ----------------------------------------------------------------
-- 12. STORAGE.OBJECTS POLICIES — uid-folder + admin global read
-- ----------------------------------------------------------------
CREATE POLICY "storage_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
  );

-- Read: owner, admin, OR student of a released file
CREATE POLICY "storage_select_owner_admin_or_released" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      OR EXISTS (
        SELECT 1 FROM public.assignment_files af
        JOIN public.assignments a ON a.id = af.assignment_id
        WHERE af.storage_path = storage.objects.name
          AND af.released = true
          AND a.student_id = auth.uid()
      )
      OR EXISTS (
        -- Allow admin to read screenshots referenced by payments
        SELECT 1 FROM public.payments p
        WHERE p.screenshot_url = storage.objects.name
          AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
    )
  );

-- ----------------------------------------------------------------
-- 13. Guarantee owner admin row
-- ----------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 14. Enable realtime for live admin dashboard
-- ----------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments','assignment_files','assignments','bids','profiles','notifications']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- already in publication, skip
      NULL;
    WHEN undefined_object THEN
      -- publication doesn't exist on this project (rare)
      NULL;
    END;
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- DONE.
-- ----------------------------------------------------------------
