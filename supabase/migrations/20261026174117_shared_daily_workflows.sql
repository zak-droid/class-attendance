-- Shared per-record storage: no whole-course array overwrites between teachers.
create table public.app_records (
  kind text not null check (kind in ('lesson','task','submission','syllabus','session','legacy_backup')),
  id text not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (kind,id)
);
create index app_records_course_id_idx on public.app_records(course_id);
alter table public.app_records enable row level security;
revoke all on public.app_records from anon;
grant select, insert, update on public.app_records to authenticated;
create policy "Approved teachers read shared records" on public.app_records for select to authenticated using (public.is_approved_teacher());
create policy "Approved teachers insert shared records" on public.app_records for insert to authenticated with check (public.is_approved_teacher());
create policy "Approved teachers update shared records" on public.app_records for update to authenticated using (public.is_approved_teacher()) with check (public.is_approved_teacher());

create function public.touch_app_record() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger app_records_updated before update on public.app_records for each row execute function public.touch_app_record();

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.app_records;
  end if;
end $$;


-- Preserve the existing backup reader's coverage for the newly shared data.
do $$ declare backup_qual text; begin
  select qual into backup_qual from pg_policies
    where schemaname='public' and tablename='courses'
      and policyname='Backup identity can read courses' and cmd='SELECT';
  if backup_qual is not null then
    execute format('create policy "Backup identity can read shared records" on public.app_records for select to authenticated using (%s)', backup_qual);
  end if;
end $$;
