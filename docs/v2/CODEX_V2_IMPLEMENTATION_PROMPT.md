We are now starting V2 of the attendance app.

Goal:
Build the Teacher-first V2 experience on top of the existing working V1 app.
Do not rebuild from scratch.
Preserve what already works: Supabase auth, database connection, Hebrew RTL, students, classes, attendance records, history, import, and deployment flow.

Very important:
Before changing product logic, preserve the current V1 state.

Step 0 — Preserve V1:
1. Inspect the repository.
2. Check git status.
3. Run the existing validation commands:
   - npm install / npm ci if needed
   - npm run build
   - npm test if tests exist
4. If the current state is stable, create a clear V1 checkpoint:
   - commit current work if needed
   - create a branch/checkpoint name for V1/MVP
5. Then create a new branch for:
   teacher-first-v2

Do not delete or rewrite the existing app.

Design source of truth:
Create this folder if it does not exist:

/docs/v2/

Add the provided design file as:

/docs/v2/DESIGN_SYSTEM.md

Before any UI work, read and follow /docs/v2/DESIGN_SYSTEM.md.

The visual direction is mandatory:
- The provided Attend Academy / deep blue reference is the primary visual model.
- Do not treat it as loose inspiration.
- Use #002B45 as the true Primary color.
- Use #005580 as the true Secondary color.
- Keep a dark premium mobile app feeling.
- Keep Hebrew RTL excellent.
- Use Heebo as the main Hebrew UI font.
- Do not introduce new colors, fonts, spacing, or component styles unless explicitly required.
- Keep status colors clear and readable.

Product direction:
V2 is not a generic attendance management system.
V2 is a daily teacher workflow app.

The app should answer:
“What does the teacher need to do right now?”

Core teacher flow:
Teacher opens app
→ sees Today
→ sees current or next class/lesson
→ starts attendance
→ all enrolled students are marked Present by default
→ teacher marks exceptions only
→ teacher reviews exceptions
→ teacher finishes attendance.

Main UX decision:
The default screen after login must be Today.
Today is the center of the app.

Recommended teacher navigation:
- Today
- Students
- History
- More

Do not treat Classes as the main teacher destination.
Classes/class management can exist, but it should not dominate the teacher workflow.
If removing the Classes tab is risky, move class management into More or keep it as a secondary area for now.

Phase 1 scope:
Implement the Teacher-first V2 experience using the existing data model as much as possible.
Do not make destructive database changes.
Do not create a large schema migration unless absolutely necessary.
If the current schema blocks a required behavior, implement the safest compatible approach first and document what schema changes are recommended later.

Phase 1 must include:

1. Today screen redesign as the main workflow screen
The Today screen should show:
- page title: היום
- current date
- clear teacher-focused explanation
- current or next relevant class/lesson if possible
- all classes/lessons available today if schedule data does not exist yet
- attendance state for each item:
  - לא התחילה
  - בתהליך
  - הושלמה
  - לא סומנה
- main CTA inside each relevant class/lesson card:
  - התחלת נוכחות
  - המשך נוכחות
  - צפייה בסיכום
  depending on the state

The primary CTA must be inside the relevant card.
Do not hide the main action in the top bar or inside a menu.

If there is no real schedule table yet:
Use existing active classes as “available today” items.
Label this clearly as a temporary V2-compatible behavior.
Do not invent fake schedule data.

2. Attendance session behavior
When the teacher starts attendance for a class/session:
- create attendance records for all active students in that class if they do not already exist
- default each student to Present
- prevent duplicate attendance records for the same student/class/date/session
- if attendance already exists, continue the existing session instead of creating duplicates

Show a clear message:
“כל התלמידים סומנו כנוכחים. סמנו רק חריגים.”

3. Attendance session screen
Build the screen around fast exception marking.

The student list should be compact.
Each student row/card should show:
- student name
- current status
- time if useful
- note indicator if a note exists
- secondary menu if needed

Do not show four large status buttons on every row by default.

Preferred interaction:
Tapping a student opens a bottom sheet / action panel with:
- נוכח
- איחר
- נעדר
- מוצדק
- הוספה / עריכת הערה

Status changes should save immediately.

4. Exceptions filter
Near the top of the attendance list, add a simple segmented control:
- כל התלמידים
- חריגים בלבד

“חריגים בלבד” should show:
- איחר
- נעדר
- מוצדק
- students with notes
- unknown/not handled if applicable

5. Finish attendance
During an active attendance session, there must be a sticky bottom action area with:
- סיום נוכחות
- compact summary:
  נוכחים · מאחרים · נעדרים · מוצדקים

The finish action should be at the bottom because the teacher scrolls through students.
Do not place finish only at the top.

If the normal bottom navigation conflicts with the sticky finish action, reduce it, hide it, or adjust spacing during the active session.

Finishing attendance should:
- mark the session/class attendance as completed if the current model supports it
- otherwise store the safest equivalent state
- show a summary after completion

6. Students screen
Keep Students as quick lookup, not heavy admin.

Students screen should support:
- search
- class filter
- student rows/cards
- basic student context
- access to student attendance history if already available

Admin-heavy actions like bulk import, delete, move class, and advanced editing should not dominate the teacher flow.
They may remain available, but secondary.

7. History screen
Keep History mobile-friendly.
Use cards, not a wide table.

History should support:
- date filter
- class filter
- summary counts
- list of attendance records
- export if already supported

Use the V2 visual system.

8. More/Admin separation
If possible in this phase, add or prepare a More area for:
- class management
- import students
- settings
- export/admin actions
- future teacher/admin separation

Do not overbuild admin in this phase.

UX rules:
- Mobile-first.
- Hebrew RTL first.
- One primary action per screen.
- Secondary actions go into menus or lower-priority links.
- Lists must remain readable with 25–30 students.
- Touch targets must be comfortable on mobile.
- Do not add long explanations to the UI.
- Do not make the teacher manage data during attendance unless necessary.
- Do not add visual patterns that are not in /docs/v2/DESIGN_SYSTEM.md.

Important edge cases:
Handle or document:
- no students in class
- no active classes
- attendance already started
- attendance already completed
- teacher forgot to take attendance for a previous class/date
- student arrives late after being marked absent
- duplicate attendance prevention
- import/admin actions still reachable somewhere

Technical rules:
- Do not break Supabase auth.
- Do not break existing RLS assumptions.
- Do not make destructive migrations.
- Do not remove working features unless replacing them safely.
- Keep existing tests working.
- Add tests where practical for new behavior.
- Run build and tests before finishing.

Deliverables:
1. Implement Phase 1 Teacher-first V2.
2. Add /docs/v2/DESIGN_SYSTEM.md.
3. Update README or project docs with:
   - V1 preserved
   - V2 branch/workflow
   - validation commands
   - known limitations
4. Provide a clear summary of:
   - what changed
   - what was preserved
   - what is still temporary because of current data model
   - what should be addressed in a later V2 data model migration
5. Run:
   - npm run build
   - npm test if available
6. If deployment uses /docs from dist, rebuild and refresh /docs only after validation passes.

Do not stop after planning.
Start implementation, but keep the scope to Phase 1.
Do not attempt advanced reporting, complex scheduling, multi-teacher permissions, or large database redesign in this first V2 implementation.
