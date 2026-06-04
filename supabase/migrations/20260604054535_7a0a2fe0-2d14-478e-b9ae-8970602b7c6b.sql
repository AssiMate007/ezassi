
-- =========== ROLES ===========
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users see own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Admins see all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Auto-grant admin to the owner email on signup
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.email = 'assimate007@gmail.com' then
    insert into public.user_roles (user_id, role) values (NEW.id, 'admin')
    on conflict do nothing;
  end if;
  insert into public.user_roles (user_id, role) values (NEW.id, 'user')
  on conflict do nothing;
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
after insert on auth.users
for each row execute function public.handle_new_user_role();

-- Backfill: if owner already signed up, give them admin now
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'assimate007@gmail.com'
on conflict do nothing;

-- =========== PAYMENTS ===========
create type public.payment_status as enum ('awaiting_payment','payment_received','file_delivered','cancelled');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  bid_id uuid not null references public.bids(id) on delete cascade,
  student_id uuid not null,
  writer_id uuid not null,
  amount integer not null,           -- total paid by student
  commission integer not null,       -- 15%
  writer_payout integer not null,    -- 85%
  screenshot_url text,
  status public.payment_status not null default 'awaiting_payment',
  payment_received_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bid_id)
);

create index payments_assignment_idx on public.payments(assignment_id);
create index payments_student_idx on public.payments(student_id);
create index payments_writer_idx on public.payments(writer_id);

grant select, insert, update on public.payments to authenticated;
grant all on public.payments to service_role;

alter table public.payments enable row level security;

create policy "Participants view payment" on public.payments
  for select to authenticated
  using (auth.uid() = student_id or auth.uid() = writer_id or public.has_role(auth.uid(), 'admin'));

create policy "Student creates payment" on public.payments
  for insert to authenticated with check (auth.uid() = student_id);

create policy "Student uploads screenshot" on public.payments
  for update to authenticated
  using (auth.uid() = student_id and status = 'awaiting_payment')
  with check (auth.uid() = student_id);

create policy "Admin updates payment" on public.payments
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =========== ASSIGNMENT FILES ===========
create table public.assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  bid_id uuid not null references public.bids(id) on delete cascade,
  writer_id uuid not null,
  storage_path text not null,
  file_name text not null,
  file_size integer not null,
  released boolean not null default false,
  created_at timestamptz not null default now(),
  unique (bid_id)
);

create index assignment_files_assignment_idx on public.assignment_files(assignment_id);

grant select, insert, update on public.assignment_files to authenticated;
grant all on public.assignment_files to service_role;

alter table public.assignment_files enable row level security;

-- Everyone involved sees the row (to show status), but only released files are downloadable
create policy "Involved see file row" on public.assignment_files
  for select to authenticated
  using (
    auth.uid() = writer_id
    or auth.uid() = (select student_id from public.assignments where id = assignment_id)
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Writer uploads file" on public.assignment_files
  for insert to authenticated with check (auth.uid() = writer_id);

create policy "Writer replaces own file" on public.assignment_files
  for update to authenticated
  using (auth.uid() = writer_id and released = false)
  with check (auth.uid() = writer_id);

create policy "Admin releases file" on public.assignment_files
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =========== STORAGE POLICIES (assignment-files bucket) ===========
-- Writers can upload into a folder named after their user id
create policy "Writers upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Writers read own files"
on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Admin reads all files"
on storage.objects for select to authenticated
using (bucket_id = 'assignment-files' and public.has_role(auth.uid(), 'admin'));

create policy "Students read released files"
on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-files'
  and exists (
    select 1 from public.assignment_files af
    join public.assignments a on a.id = af.assignment_id
    where af.storage_path = storage.objects.name
      and af.released = true
      and a.student_id = auth.uid()
  )
);

create policy "Writers update own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'assignment-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =========== NOTIFICATIONS ===========
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, read, created_at desc);

grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

create policy "Users see own notifications" on public.notifications
  for select to authenticated using (auth.uid() = user_id);

create policy "Anyone inserts notifications" on public.notifications
  for insert to authenticated with check (true);

create policy "Users mark own read" on public.notifications
  for update to authenticated using (auth.uid() = user_id);
