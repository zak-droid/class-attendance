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

## Teacher-first V2

- The preserved V1 checkpoint is the `v1-mvp` branch.
- V2 development lives on the `teacher-first-v2` branch. It does not replace the live `main` branch until it is explicitly approved.
- The primary navigation is Today, Students, History, and More. Class and import administration live under More.
- The Today workflow starts every active student as Present, then lets the teacher update exceptions from a student action sheet.
- Validate V2 with `npm ci`, `npm run build`, and `npm test` before refreshing `/docs` from `/dist`.

### Phase 1 limitations

- The existing database has no class schedule, so every active class is shown as available today. V2 does not invent lesson times.
- The existing database has no attendance-session completion field. “Completed” is currently an in-memory UI state and resets after refresh. Attendance records themselves remain safely stored in Supabase.
- Status-change timestamps cannot be updated independently with the current attendance update contract, so the stored time remains unchanged when a status is edited.
- Previous dates can be reviewed and exported in History, but Phase 1 does not create retroactive attendance sessions because the current RPC is intentionally limited to the daily workflow.

The V2 product, design, layout, component, and workflow source documents are preserved in `docs/v2/`.

