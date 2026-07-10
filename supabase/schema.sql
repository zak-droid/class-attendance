-- Class Attendance shared database
-- Run this file in the Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.teacher_access (
  email text primary key check (email = lower(email)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  course_id uuid not null references public.courses(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  course_id uuid not null references public.courses(id),
  date date not null,
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text not null default 'Present' check (status in ('Present', 'Late', 'Absent', 'Excused')),
  notes text,
  marked_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, date)
);

create or replace function public.is_approved_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_access
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and active = true
  );
$$;

revoke all on function public.is_approved_teacher() from public;
grant execute on function public.is_approved_teacher() to authenticated;

alter table public.teacher_access enable row level security;
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.attendance_logs enable row level security;

drop policy if exists "Teachers can view their access" on public.teacher_access;
create policy "Teachers can view their access" on public.teacher_access
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Approved teachers manage courses" on public.courses;
create policy "Approved teachers manage courses" on public.courses
  for all to authenticated
  using (public.is_approved_teacher())
  with check (public.is_approved_teacher());

drop policy if exists "Approved teachers manage students" on public.students;
create policy "Approved teachers manage students" on public.students
  for all to authenticated
  using (public.is_approved_teacher())
  with check (public.is_approved_teacher());

drop policy if exists "Approved teachers manage attendance" on public.attendance_logs;
create policy "Approved teachers manage attendance" on public.attendance_logs
  for all to authenticated
  using (public.is_approved_teacher())
  with check (public.is_approved_teacher());

grant select on public.teacher_access to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.attendance_logs to authenticated;

create or replace function public.start_attendance(p_course_id uuid, p_date date, p_time text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.attendance_logs (student_id, course_id, date, time, status, notes, marked_by)
  select s.id, s.course_id, p_date, p_time, 'Present', '', auth.uid()
  from public.students s
  join public.courses c on c.id = s.course_id
  where s.course_id = p_course_id
    and s.active = true
    and c.active = true
  on conflict (student_id, course_id, date) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.start_attendance(uuid, date, text) to authenticated;

insert into public.courses (id, name, description, active) values
  ('10000000-0000-4000-8000-000000000001', 'Algebra 100', 'Foundations of algebra and problem solving', true),
  ('10000000-0000-4000-8000-000000000002', 'History 101', 'People, places, and turning points', true),
  ('10000000-0000-4000-8000-000000000003', 'AppSheet Academy 101', 'Build useful apps without code', true)
on conflict (id) do nothing;

insert into public.students (id, name, email, course_id, active) values
  ('20000000-0000-4000-8000-000000000001', 'Maya Cohen', 'maya.cohen@example.edu', '10000000-0000-4000-8000-000000000001', true),
  ('20000000-0000-4000-8000-000000000002', 'Liam Reed', 'liam.reed@example.edu', '10000000-0000-4000-8000-000000000001', true),
  ('20000000-0000-4000-8000-000000000003', 'Sofia Patel', 'sofia.patel@example.edu', '10000000-0000-4000-8000-000000000001', true),
  ('20000000-0000-4000-8000-000000000004', 'Noah Kim', 'noah.kim@example.edu', '10000000-0000-4000-8000-000000000001', true),
  ('20000000-0000-4000-8000-000000000005', 'Ava Martin', 'ava.martin@example.edu', '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000006', 'Ethan Levy', 'ethan.levy@example.edu', '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000007', 'Mia Brooks', 'mia.brooks@example.edu', '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000008', 'Olivia Chen', 'olivia.chen@example.edu', '10000000-0000-4000-8000-000000000003', true),
  ('20000000-0000-4000-8000-000000000009', 'Daniel Garcia', 'daniel.garcia@example.edu', '10000000-0000-4000-8000-000000000003', true),
  ('20000000-0000-4000-8000-000000000010', 'Ella Wilson', 'ella.wilson@example.edu', '10000000-0000-4000-8000-000000000003', true),
  ('20000000-0000-4000-8000-000000000011', 'Leo Novak', 'leo.novak@example.edu', '10000000-0000-4000-8000-000000000003', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courses') then
    alter publication supabase_realtime add table public.courses;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'students') then
    alter publication supabase_realtime add table public.students;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_logs') then
    alter publication supabase_realtime add table public.attendance_logs;
  end if;
end $$;

insert into public.teacher_access (email) values
  ('rotman555@gmail.com'),
  ('tsachiachrak@gmail.com'),
  ('dotanhaim@gmail.com')
on conflict (email) do update set active = true;
