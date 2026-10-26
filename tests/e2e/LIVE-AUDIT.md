# Live application audit — 2026-10-26

Executed through Chrome UI at https://zak-droid.github.io/class-attendance/ using the owner's existing account, authenticated by the normal email sign-in flow. This audit tested the deployed application, not the locally modified source or mocked database.

## Test records created

- Course: `בדיקת Codex 26-10-2026`, renamed to `בדיקת Codex — שם מעודכן`.
- Description: `קורס בדיקה טכנית בלבד — נתונים פיקטיביים`.
- Two synthetic students: supplied `יעל` + `בדיקהכהן` and `יעל` + `בדיקהלוי`, with distinct example.com addresses. Both were incorrectly stored/displayed as `יעל`.
- Attendance for 2026-10-26: one Late, one Present; a synthetic note; lesson topic `מפגש בדיקה Codex — בדיקת שמירה`.
- Records remain available for follow-up; existing teacher/student data was not edited.

## Observed results

1. Create course: succeeded through UI.
2. Rename course: succeeded; new name visible after full page reload. The reported save failure was NOT reproduced under the owner's account. This does not establish that another teacher has the same permissions or behavior.
3. Paste a TSV table with first name, family name and email headers: importer accepted two rows, but attendance showed two identical first names. Family-name loss reproduced in production.
4. Start attendance and change one status to Late: succeeded.
5. Save a note: succeeded; note and attendance status survived reload and were visible in History.
6. Save lesson topic: succeeded and survived same-browser reload. Cross-device persistence remains unverified; source implementation currently stores lessons locally.
7. Finish attendance: changed course to completed. Full reload changed the same course back to in progress. Completion persistence defect reproduced.
8. History: selecting test course showed today's attendance and lesson topic. Current deployed UI has date/course selection but lacks the locally added all-dates and student filters.

Evidence screenshot: `outputs/live-audit/history.png` (local, ignored by Git).

## Remaining verification

- Reproduce course save with the affected teacher's permissions; owner account success alone is insufficient.
- Verify fixes on a deployed preview or equivalent real-backend configuration; local mocked E2E success does not establish production correctness.
- Shared lesson, syllabus and completion persistence across independent devices.
- Historical creation/editing, full-course student history, spreadsheet upload, exports, offline reconnect and biometric sign-in on a physical device.

## Extended real-user walkthrough

Performed later on 2026-10-26 with the same authorized owner account. All changes below are confined to the named synthetic course.

| Scenario | Result / evidence |
| --- | --- |
| Pick a past date with no attendance | Calendar selection works. Empty state has no action to open attendance for that date. Backfilling a missed class cannot be completed through this UI. |
| Add a student after starting attendance | Added `נועה בדיקה מאוחרת`, `noa-late@example.com` through the single-student form. Course shows 3 students; continued attendance still lists 2. SQL confirms the new student has zero attendance rows. |
| Evaluate new student's statistics | Task dashboard displays 100% attendance despite zero attendance records. Source explicitly defaults zero sessions to 100%. This can mislead eligibility decisions. |
| Add course task | Added `מטלת בדיקה Codex`; it appears for all three synthetic students and survives same-browser reload. |
| Mark task complete | Marked the new task for the synthetic new student. It survives same-browser reload. |
| Save feedback without completing a task | Entered `משוב פיקטיבי לבדיקה` through the note editor of the uncompleted peer exercise. Saving changed the task to completed. The note editor has no explicit completion selection. |
| Save syllabus and run local analysis | Saved three synthetic topics; local analysis reports 1 of 3 covered, labels itself local, and provides recommendations. UI works within this browser. |
| Shared persistence | Live public schema contains only teacher_access, courses, students, attendance_logs. No lesson, syllabus, task or submission tables/columns. Source routes these features to localStorage. They are not shared records; same-browser reload success is insufficient for two-instructor work. Cross-device UI test was not performed. |
| Export CSV | UI reports download success. File bytes were not retrieved/validated in this live session, so this remains partially verified. |
| Repair student name | Renamed one synthetic `יעל` to `יעל בדיקה מתוקנת`; linked historical attendance displays the repaired name. |
| Edit previous attendance | Seeded four synthetic records directly in DB (two test students × 2026-10-12 and 2026-10-19) solely to exercise existing-history UI. Used UI to change the corrected-name student on 2026-10-19 from Present to Absent. Reload preserved Absent; 2026-10-26 remained Late. |
| Record previous lesson | Saved `מבוא לבדיקה — מפגש קודם` for 2026-10-19. Same-browser reload preserved separate topics for the 19th and 26th. |
| Three-session student statistics | Correctly shows 1 Present, 1 Late, 1 Absent, 67%. Card lists recent absences/lateness, not a complete dated ledger of every attended class. |
| Sign out / sign in | Sign-out returned to login. New email link successfully restored access to the course and three students. |
| Used/expired login link | Opening the older already-used email link returned otp_expired in the URL, but UI silently showed generic login with no explanation. Then explicitly expanded the newest email and signed in successfully. |

Additional evidence: `outputs/live-audit/student-three-sessions.png`.

### Release blockers / priorities

1. Preserve full names on import; repairing existing first-name-only records requires the original roster or a verified manual mapping.
2. Sync lessons, syllabus, tasks, feedback and completion through shared storage, with migration of existing browser-local work.
3. Include newly enrolled students in an already-started session with an explicit attendance decision.
4. Support creation of a missed historical session, with visible course/date context.
5. Persist session completion, and present clear save/sync errors.
6. Represent no attendance data as unknown, not 100%; avoid assigning certificate eligibility from missing data.
7. Save task feedback without implicitly marking a task complete.
8. Explain expired login links and offer a fresh-link action.

### Database permission concern found during inspection

The live schema contains policies named `Backup identity cannot insert/update/delete ...` whose predicates permit any authenticated identity other than one excluded UUID. Similar write policies exist on teacher_access. These may broaden access beyond the approved-teacher rule; inspect permissive/restrictive policy composition and grants before release. No policy was altered during this audit.

### Still not established

The system is not yet cleared for unrestricted daily use. Physical biometric login, independent devices/instructors, Excel file upload in production, full CSV contents, archive/restore, course transfers and concurrent edits remain unverified. Owner-account course rename succeeds; Rotem's original save failure remains unexplained. No live fixes were deployed in this walkthrough.

### Network-loss test completed

Used the browser's documented developer capability to simulate offline mode on the test tab. Changed today's corrected-name student's status from Late to Excused through the UI. The app displayed offline status and queued the action. Restored normal networking immediately after observing the offline result. App displayed a pending sync, then the count returned to zero. Read-only SQL confirmed 2026-10-26 = Excused, 2026-10-19 = Absent, 2026-10-12 = Present. Thus this existing-record offline-edit/reconnect path passed. No browser network override remains enabled. The tool operation itself took unusually long; this is not attributed to the app without further evidence.

Repeated CSV export with a browser download observer: app remained responsive, but the observer timed out. This does not prove the download is broken; the actual exported bytes remain unverified.


### Permission concern resolved by inspection

A subsequent query included pg_policies.permissive and confirmed all `Backup identity cannot ...` policies are RESTRICTIVE, not PERMISSIVE. They do not broaden access. No existing policy was dropped or changed. The new shared-record table has approved-teacher RLS and copies the existing backup SELECT predicate.


## Fixes deployed and verified — 2026-10-26

The earlier findings above describe the pre-fix build. They are superseded by these results for the repaired workflows.

- Source fixes published to `teacher-first-v2`; GitHub build/test/deploy runs 40372045741 and 40373203581 succeeded. Additive `shared_daily_workflows` migration applied (remote version 20261026174117).
- 18 code tests and 28 Chromium UI tests (desktop and Pixel 7 viewport). Browser suite uses isolated mock DB; live checks below use real Supabase through normal UI.
- Chrome owner account: new student Noa appeared as unmarked in the existing session, was explicitly marked Late, and persisted. Lesson topic saved to shared server records. Session completion survived reload. A slow server response exposed absent progress feedback; added disabled “saving completion” state and shared-write timeout, with regression test.
- Past date 2026-10-05: created a Present record for the renamed synthetic Yael through History UI, then saved a separate dated lesson topic. No SQL fixture was used for this new past record.
- Independent in-app browser with separate storage: signed in normally through a newly requested email link. Saw the completed session, lesson topic, custom task and prior submissions from Chrome. This verifies server persistence beyond the original localStorage.
- Independent browser: saved feedback on the first synthetic Yael's outstanding peer obligation; completion remained false. Feedback persisted in app_records.
- Uploaded an XLSX file through the production file picker with first name, blank column, family name and email. Imported synthetic `תמר ישראלי` with the full name intact. The new enrolment reopened the completed course as in progress and appeared unmarked. Explicitly marked Present and completed again.
- Downloaded the actual production CSV to disk and read its bytes: full name and both historical/current dates present. This exposed missing custom tasks/feedback/notes; export corrected and covered by code regression, including transferred-student history and CSV escaping.
- SQL RLS assertions in rollback transactions: all three approved teacher emails can read/insert/update shared rows; unapproved email cannot read/insert. Course rename permission also verified with Rotem's actual auth user ID/email claims in a rollback transaction. This is a policy test, not a login as Rotem.
- Existing real data: 18 active students in the NATAL course still have single-word names from past imports. Original roster requested; no family names invented or real student records rewritten. Overlong malformed historical names seen in an inactive test course were not repurposed as a roster.

Limitations: physical fingerprint hardware and simultaneous edits to the same field by different instructors were not exercised. Existing browser-local data on other devices imports when each device next opens the updated app. Conflicts preserve the first shared version and archive every original local version for recovery (see supabase/README.md).
