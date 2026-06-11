-- ================================================================
-- DEFINITIVE FIX — replaces every has_role() call in every policy
-- ================================================================

-- Step 1: Grant has_role back so existing code doesn't crash during migration
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Step 2: Drop EVERY policy that might call has_role — by name
-- user_roles
DROP POLICY IF EXISTS "Admins view all roles"         ON public.user_roles;
DROP POLICY IF EXISTS "Users insert own role"         ON public.user_roles;

-- assignments  
DROP POLICY IF EXISTS "Admins manage assignments"     ON public.assignments;
DROP POLICY IF EXISTS "any_user_post_assignment"      ON public.assignments;
DROP POLICY IF EXISTS "Students post assignments"     ON public.assignments;
DROP POLICY IF EXISTS "student_insert_assignment"     ON public.assignments;

-- bids
DROP POLICY IF EXISTS "Admins manage bids"            ON public.bids;
DROP POLICY IF EXISTS "any_user_place_bid"            ON public.bids;
DROP POLICY IF EXISTS "Writers place bids"            ON public.bids;
DROP POLICY IF EXISTS "writer_insert_bid"             ON public.bids;
DROP POLICY IF EXISTS "Writers insert own bids"       ON public.bids;

-- payments
DROP POLICY IF EXISTS "Participants view payment"     ON public.payments;
DROP POLICY IF EXISTS "Student creates payment"       ON public.payments;
DROP POLICY IF EXISTS "Student uploads screenshot"    ON public.payments;
DROP POLICY IF EXISTS "Student updates payment"       ON public.payments;
DROP POLICY IF EXISTS "Admin updates payment"         ON public.payments;
DROP POLICY IF EXISTS "payment_select"                ON public.payments;
DROP POLICY IF EXISTS "payment_insert"                ON public.payments;
DROP POLICY IF EXISTS "payment_update"                ON public.payments;

-- notifications
DROP POLICY IF EXISTS "Anyone inserts notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Insert notifications safely"   ON public.notifications;
DROP POLICY IF EXISTS "Users see own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users mark own read"           ON public.notifications;
DROP POLICY IF EXISTS "notif_select"                  ON public.notifications;
DROP POLICY IF EXISTS "notif_insert"                  ON public.notifications;
DROP POLICY IF EXISTS "notif_update"                  ON public.notifications;

-- assignment_files
DROP POLICY IF EXISTS "Writers insert files"          ON public.assignment_files;
DROP POLICY IF EXISTS "Participants view files"       ON public.assignment_files;
DROP POLICY IF EXISTS "Admin releases files"          ON public.assignment_files;
DROP POLICY IF EXISTS "afile_insert"                  ON public.assignment_files;
DROP POLICY IF EXISTS "afile_select"                  ON public.assignment_files;
DROP POLICY IF EXISTS "afile_update"                  ON public.assignment_files;

-- storage
DROP POLICY IF EXISTS "Writers upload own folder"     ON storage.objects;
DROP POLICY IF EXISTS "Writers read own files"        ON storage.objects;
DROP POLICY IF EXISTS "Admin reads all files"         ON storage.objects;
DROP POLICY IF EXISTS "Students read released files"  ON storage.objects;
DROP POLICY IF EXISTS "Writers update own files"      ON storage.objects;
DROP POLICY IF EXISTS "Students upload screenshots"   ON storage.objects;
DROP POLICY IF EXISTS "auth_upload"                   ON storage.objects;
DROP POLICY IF EXISTS "auth_update"                   ON storage.objects;
DROP POLICY IF EXISTS "auth_read_own"                 ON storage.objects;
DROP POLICY IF EXISTS "auth_read_released"            ON storage.objects;
DROP POLICY IF EXISTS "auth_admin_read"               ON storage.objects;
DROP POLICY IF EXISTS "storage_insert"                ON storage.objects;
DROP POLICY IF EXISTS "storage_update"                ON storage.objects;
DROP POLICY IF EXISTS "storage_select"                ON storage.objects;

-- Step 3: Recreate ALL policies WITHOUT has_role()

-- user_roles
CREATE POLICY "admin_view_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "user_insert_own_role" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- assignments: anyone authenticated can post or bid
CREATE POLICY "assignment_select" ON public.assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assignment_insert" ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "assignment_update" ON public.assignments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- bids: anyone can bid
CREATE POLICY "bid_select" ON public.bids
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bid_insert" ON public.bids
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = writer_id);

CREATE POLICY "bid_update" ON public.bids
  FOR UPDATE TO authenticated
  USING (auth.uid() = writer_id OR auth.uid() = (
    SELECT student_id FROM public.assignments WHERE id = assignment_id
  ) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- payments
CREATE POLICY "payment_select" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "payment_insert" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "payment_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- notifications: open insert so admin can notify anyone
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- assignment_files
CREATE POLICY "afile_insert" ON public.assignment_files
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = writer_id);

CREATE POLICY "afile_select" ON public.assignment_files
  FOR SELECT TO authenticated
  USING (auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.assignments WHERE id = assignment_id AND student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "afile_update" ON public.assignment_files
  FOR UPDATE TO authenticated
  USING (auth.uid() = writer_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- storage: simple uid folder check, no functions
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assignment-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.assignment_files af
      JOIN public.assignments a ON a.id = af.assignment_id
      WHERE af.storage_path = storage.objects.name
        AND af.released = true AND a.student_id = auth.uid()
    )
  ));

-- Step 4: Guarantee admin row
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;

-- Step 5: is_banned column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
