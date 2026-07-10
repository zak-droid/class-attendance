# Class Attendance

A mobile-first, teacher-controlled attendance app with shared courses,
students, daily records, history, and CSV export.

Live site: https://zak-droid.github.io/class-attendance/

## Architecture

- React + TypeScript + Vite + Tailwind CSS
- Supabase Auth Magic Links
- Supabase Postgres with Row Level Security
- Supabase Realtime Postgres Changes
- GitHub Pages published from `main` -> `/docs`

## Local development

1. Copy `.env.example` to `.env.local` if using a different Supabase project.
2. Run `npm ci`.
3. Run `npm run dev`.

## Build and publish

1. Run `npm run build`.
2. Replace `docs/` with the contents of `dist/`.
3. Commit source changes and `docs/` to `main`.
4. GitHub Pages must be set to **Deploy from a branch**: `main` / `/docs`.

## Shared database

Run `supabase/schema.sql` once in the Supabase SQL Editor. Configure the
production Site URL and Redirect URL in Supabase Authentication.

## Safety

Only active emails in `public.teacher_access` may use shared data. Keep Row
Level Security enabled. Never place a Supabase service-role key, database
password, or GitHub token in this public repository.
