# Class Attendance

A mobile-first, teacher-controlled attendance app with shared courses, students, daily records, history, and CSV export.

Hosted with GitHub Pages at `https://zak-droid.github.io/class-attendance/`.

## Shared setup

The app uses Supabase for teacher sign-in, the shared database, row-level security, and realtime synchronization.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. The approved teacher emails are already listed in `public.teacher_access`.
4. Enable GitHub Pages with GitHub Actions as the source.

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes the app automatically.

## Local development

Copy `.env.example` to `.env.local`, add the Supabase project values, then run:

```bash
npm install
npm run dev
```

## Safety

Only email addresses listed in `teacher_access` can read or change data. Approved teachers sign in using a passwordless email link. The browser uses the Supabase publishable key; never put a Supabase service-role key in this project.
