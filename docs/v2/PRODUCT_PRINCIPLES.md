# Product Principles — Teacher-first V2

## Product definition

V2 is not a generic attendance management dashboard.

V2 is a daily workflow app for teachers.

The app should answer one question:

> What does the teacher need to do right now?

## Core product idea

The teacher opens the app, sees the relevant lesson/class for today, starts attendance, marks only exceptions, and finishes.

The main flow is:

```text
Open app
→ Today
→ Current/next lesson
→ Start attendance
→ Everyone is Present by default
→ Mark exceptions only
→ Finish attendance
```

## Primary user

The primary user for V2 Phase 1 is the teacher during the school/studio/class day.

The teacher is usually on mobile and may be using the app during class. The interface must be fast, clear, and forgiving.

## Product priorities

1. Fast attendance taking.
2. Clear current/next lesson context.
3. Exception-based marking.
4. Mobile-first usability.
5. Hebrew RTL quality.
6. Consistent visual system.
7. Preserve working V1 features where possible.

## What the teacher should not need to do during attendance

- Manage classes.
- Import students.
- Edit complex student data.
- Navigate through admin screens.
- Read long explanations.
- Choose status for every student one by one.

## Teacher navigation priority

Recommended teacher navigation:

1. Today
2. Students
3. History
4. More

Class management should not dominate the teacher workflow. If class management remains available, it should live under More or as a secondary area.

## Phase 1 scope

V2 Phase 1 should focus on:

- Today as the default screen.
- Teacher-first attendance flow.
- Attendance records created as Present by default.
- Compact student list.
- Exception marking.
- Finish attendance action.
- Mobile-friendly history.
- Admin-heavy actions moved out of the main workflow where safe.

## Phase 1 non-goals

Do not attempt these in Phase 1 unless explicitly approved:

- Full multi-teacher permissions redesign.
- Complex recurring schedule engine.
- Advanced reporting dashboards.
- Parent communication.
- Major destructive database migration.
- Full rebuild from scratch.
- New design direction unrelated to the provided reference.

## Preserve V1

Before V2 work begins:

- Confirm the current app builds.
- Confirm tests pass if tests exist.
- Commit or checkpoint the current state.
- Create a separate V2 branch.

V2 must build on top of the existing working app unless a specific change is approved.

