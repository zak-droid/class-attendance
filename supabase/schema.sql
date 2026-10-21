create table if not exists public.teacher_access (
  email text primary key,
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
  course_id uuid not null references public.courses(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  date date not null,
  time text not null,
  status text not null check (status in ('Present', 'Late', 'Absent', 'Excused')),
  notes text,
  marked_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (student_id, course_id, date)
);

create or replace function public.is_approved_teacher()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.teacher_access
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and active = true
  );
$$;

create or replace function public.start_attendance(
  p_course_id uuid,
  p_date date,
  p_time text
)
returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_approved_teacher() then
    raise exception 'Not authorized';
  end if;

  insert into public.attendance_logs (student_id, course_id, date, time, status, marked_by)
  select s.id, s.course_id, p_date, p_time, 'Present', auth.uid()
  from public.students s
  join public.courses c on c.id = s.course_id
  where s.course_id = p_course_id
    and s.active = true
    and c.active = true
  on conflict (student_id, course_id, date) do nothing;
end;
$$;

alter table public.teacher_access enable row level security;
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.attendance_logs enable row level security;


-- Phase 4.3: Course Syllabus & Lesson Logs (Optional Cloud Sync)
alter table public.courses add column if not exists syllabus text;

create table if not exists public.lesson_logs (
  id text primary key,
  course_id uuid references public.courses(id) on delete cascade,
  date date not null,
  topic text not null,
  summary text,
  instructor_email text,
  created_at timestamptz not null default now(),
  unique (course_id, date)
);

alter table public.lesson_logs enable row level security;
