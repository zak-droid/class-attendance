# Teacher-first V2 implementation notes

## Scope delivered in Phase 1

- Today is the default workspace.
- The primary navigation is Today, Students, History, and More.
- Active classes appear on Today as available lessons because the current schema has no schedule table.
- Starting attendance keeps the existing secure Supabase RPC and its default-Present behavior.
- Attendance is edited from compact student rows and a mobile bottom action sheet.
- Exceptions include non-Present statuses and students with notes.
- The active session has a sticky finish action and hides the bottom navigation.
- Students is focused on search and lookup; class, student, and import administration is available under More.
- History uses responsive cards instead of a wide table.

## Intentionally temporary behavior

The current schema stores attendance logs but does not store an attendance session or a completed state. Phase 1 therefore keeps completion in memory only. Refreshing the page clears the completed badge, but it does not remove or change attendance records.

The current update API supports status and notes but not a separate marked-time update. Editing a status therefore preserves the existing stored time.

History can review and export previous dates. Phase 1 does not create retroactive attendance sessions because the current start-attendance RPC is kept aligned with the existing daily workflow.

These limitations are documented rather than hidden, and no Supabase schema, RLS policy, authentication rule, or internal attendance value was changed.

## Validation and release

Run:

```text
npm ci
npm run build
npm test
```

Only after all checks pass, replace `docs/` with the fresh contents of `dist/`. V2 is developed on `teacher-first-v2`; the live `main` branch remains the V1 production release until explicit approval.

