-- Add schedules without touching any existing attendance, lessons or rosters.
alter table public.app_records drop constraint app_records_kind_check;
alter table public.app_records add constraint app_records_kind_check
  check (kind in ('lesson','task','submission','syllabus','session','legacy_backup','schedule'));
