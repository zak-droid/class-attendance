# Database


## Shared daily workflows (2026-10-26)

Apply `migrations/20261026173040_shared_daily_workflows.sql` after `schema.sql` before publishing this frontend. It adds `app_records` (RLS protected), a timestamp trigger, realtime publication and the existing backup reader predicate. Existing tables/policies/data are preserved. Applied to the live project on 2026-10-26.

Each browser imports its legacy lessons, syllabi, custom tasks and submissions on its first successful online load. Existing shared records win conflicts; every original local record also has a `legacy_backup` row containing device ID, original kind/key and original payload. Local legacy keys are retained. Conflicting versions can be inspected and restored by an administrator; they are never silently deleted. Migration only marks successful after all writes succeed.

Records from a device which has not opened the updated app remain on that device until it reconnects. Opening the app on each teacher's original device performs that import. Attendance edits continue to queue offline. Shared lesson/task/syllabus forms retain their content and show an explicit error if offline; retry when connected.

Verification: approved-teacher read/insert/update tested as all three allowed teacher emails inside a rolled-back database transaction; an unapproved identity could not read or insert shared records. Existing backup write-denial policies were verified RESTRICTIVE and retained.
