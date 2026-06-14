-- Final definitive RLS fix — drop every has_role policy and replace cleanly

-- Grant has_role back so nothing crashes
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- assignment_files policies
DROP POLICY IF EXISTS "Involved see file row"     ON public.assignment_files;
DROP POLICY IF EXISTS "Writer uploads file"       ON public.assignment_files;
DROP POLICY IF EXISTS "Writer replaces own file"  ON public.assignment_files;
DROP POLICY IF EXISTS "Admin releases file"       ON public.assignment_files;
DROP POLICY IF EXISTS "afile_insert"              ON public.assignment_files;
DROP POLICY IF EXISTS "afile_select"              ON public.assignment_files;
DROP POLICY IF EXISTS "afile_update"              ON public.assignment_files;

CREATE POLICY "afile_select" ON public.assignment_files FOR SELECT TO authenticated
  USING (
    auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.assignments WHERE id = assignment_id AND student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "afile_insert" ON public.assignment_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = writer_id);
CREATE POLICY "afile_update" ON public.assignment_files FOR UPDATE TO authenticated
  USING (
    (auth.uid() = writer_id AND released = false)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    (auth.uid() = writer_id AND released = false)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "afile_delete" ON public.assignment_files FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- payments policies
DROP POLICY IF EXISTS "Participants view payment"   ON public.payments;
DROP POLICY IF EXISTS "Student creates payment"     ON public.payments;
DROP POLICY IF EXISTS "Student uploads screenshot"  ON public.payments;
DROP POLICY IF EXISTS "Student updates payment"     ON public.payments;
DROP POLICY IF EXISTS "Admin updates payment"       ON public.payments;
DROP POLICY IF EXISTS "payment_select"              ON public.payments;
DROP POLICY IF EXISTS "payment_insert"              ON public.payments;
DROP POLICY IF EXISTS "payment_update"              ON public.payments;

CREATE POLICY "payment_select" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "payment_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "payment_update" ON public.payments FOR UPDATE TO authenticated
  USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- notifications policies
DROP POLICY IF EXISTS "Anyone inserts notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Insert notifications safely"   ON public.notifications;
DROP POLICY IF EXISTS "Users see own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users mark own read"           ON public.notifications;
DROP POLICY IF EXISTS "notif_select"                  ON public.notifications;
DROP POLICY IF EXISTS "notif_insert"                  ON public.notifications;
DROP POLICY IF EXISTS "notif_update"                  ON public.notifications;

CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- storage: drop all and recreate
DROP POLICY IF EXISTS "Writers upload own folder"    ON storage.objects;
DROP POLICY IF EXISTS "Writers read own files"       ON storage.objects;
DROP POLICY IF EXISTS "Admin reads all files"        ON storage.objects;
DROP POLICY IF EXISTS "Students read released files" ON storage.objects;
DROP POLICY IF EXISTS "Writers update own files"     ON storage.objects;
DROP POLICY IF EXISTS "Students upload screenshots"  ON storage.objects;
DROP POLICY IF EXISTS "auth_upload"                  ON storage.objects;
DROP POLICY IF EXISTS "auth_update"                  ON storage.objects;
DROP POLICY IF EXISTS "auth_read_own"                ON storage.objects;
DROP POLICY IF EXISTS "auth_read_released"           ON storage.objects;
DROP POLICY IF EXISTS "auth_admin_read"              ON storage.objects;
DROP POLICY IF EXISTS "storage_insert"               ON storage.objects;
DROP POLICY IF EXISTS "storage_update"               ON storage.objects;
DROP POLICY IF EXISTS "storage_select"               ON storage.objects;

CREATE POLICY "storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assignment-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assignment-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assignment-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.assignment_files af
      JOIN public.assignments a ON a.id = af.assignment_id
      WHERE af.storage_path = storage.objects.name AND af.released = true AND a.student_id = auth.uid()
    )
  ));

-- Guarantee admin row
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- is_banned column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- DELETE grant on assignment_files for admin (for file rejection)
GRANT DELETE ON public.assignment_files TO authenticated;
