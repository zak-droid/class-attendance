# Teacher Workflow — V2

## Ideal daily flow

The teacher opens the app and lands on Today.

Today should immediately show:

- The current lesson if one is happening now.
- Otherwise, the next upcoming lesson.
- Other lessons/classes relevant for today.
- Attendance state for each lesson/class.
- A clear primary action for the relevant item.

## Attendance states

Use these user-facing Hebrew states:

- `לא התחילה` — attendance has not started.
- `בתהליך` — attendance exists but is not finished.
- `הושלמה` — attendance was completed.
- `לא סומנה` — the lesson/class passed and attendance was not taken.

## Today screen behavior

### If there is a current lesson

Show it as the main card at the top.

Primary CTA:

- `התחלת נוכחות` if not started.
- `המשך נוכחות` if in progress.
- `צפייה בסיכום` if completed.

### If there is no current lesson but there is a next lesson

Show the next lesson as the main card.

Primary CTA can still be available if the product allows early attendance, or disabled if not supported.

### If there is no schedule data yet

Use existing active classes as Today-compatible items.

Do not invent fake schedule data.

Label behavior internally as temporary V2 compatibility if needed.

### If there are no active classes

Show an empty state:

Title:
`אין כיתות פעילות`

Body:
`כדי להתחיל לסמן נוכחות צריך להוסיף כיתה ותלמידים.`

CTA:
`ניהול כיתות`

This CTA should lead to More/Admin, not dominate the teacher flow.

## Starting attendance

When the teacher starts attendance:

1. Create attendance records for all active/enrolled students if they do not already exist.
2. Default every student to `Present`.
3. Prevent duplicate records for the same student/class/date/session.
4. Open the attendance session screen.
5. Show this message:

```text
כל התלמידים סומנו כנוכחים. סמנו רק חריגים.
```

## Attendance session workflow

The attendance session is not a table of buttons.

It is a compact list optimized for exceptions.

Each student row/card should show:

- Student name.
- Current status.
- Time if relevant, especially for Late.
- Note indicator if a note exists.
- Optional secondary menu.

Default behavior:

- Students start as Present.
- The teacher taps only students who are exceptions.

## Changing student status

Tapping a student opens a bottom sheet/action panel with:

- `נוכח`
- `איחר`
- `נעדר`
- `מוצדק`
- `הוספה / עריכת הערה`

Status changes should save immediately.

If a student was marked Absent and later arrives, the teacher can tap the student and change to Late. The system should update the status and, if supported, save the new timestamp.

## Exceptions filter

The attendance screen must have a visible segmented control near the top:

```text
כל התלמידים | חריגים בלבד
```

`חריגים בלבד` should include:

- Late.
- Absent.
- Excused.
- Students with notes.
- Unknown/not handled if that state exists.

## Finishing attendance

The attendance session screen must include a sticky bottom action area.

Primary CTA:

`סיום נוכחות`

The sticky area should also show a compact summary:

```text
נוכחים · מאחרים · נעדרים · מוצדקים
```

Finishing attendance should:

- Mark the attendance session as completed if supported by the current model.
- Otherwise store the safest equivalent completion state.
- Show a completion summary.
- Return to Today or the session summary.

## Forgotten attendance

If a lesson/class has passed and attendance was not taken, Today should show it as:

`לא סומנה`

CTA:

`סימון עכשיו`

Do not punish the teacher. Help them complete the missing action.

## Student not on the list

During attendance, this should not be a dominant action.

Allowed placements:

- Secondary menu.
- Small link at the bottom of the list: `הוספת תלמיד לשיעור`.

Flow:

1. Search existing student or create a new student.
2. Add to this class/session.
3. Add attendance record for today.
4. Return to the session.

## No students in class

Show an empty state in the attendance session:

Title:
`אין תלמידים בכיתה הזו`

Body:
`אפשר להוסיף תלמידים דרך אזור הניהול.`

CTA:
`הוספת תלמידים`

Keep this secondary to the teacher workflow.

