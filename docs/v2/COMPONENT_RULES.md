# Component Rules — V2

## Goal

V2 screens should be built from consistent reusable components.

Do not rebuild each screen with one-off markup and new visual patterns.

## Required component patterns

### AppShell

Purpose:
Provide consistent app structure, RTL direction, dark shell, page content, and navigation handling.

Rules:

- Must support Hebrew RTL.
- Must use the V2 design system colors.
- Must support mobile-first layout.
- Must handle bottom navigation spacing.
- During active attendance, must allow sticky finish action to take priority.

### PageHeader

Purpose:
Show page title and context.

Rules:

- Use concise Hebrew titles.
- Avoid repeating the product name on every screen.
- Can include date/context line where useful.
- Should not contain the main CTA if that CTA belongs inside a lesson card.

### BottomNav

Recommended teacher tabs:

- `היום`
- `תלמידים`
- `היסטוריה`
- `עוד`

Rules:

- Today must be the default and most important tab.
- Do not make class management a dominant teacher tab unless explicitly approved.
- Active state must be clear.
- Must not conflict with the active attendance sticky finish bar.

### TodayLessonCard

Purpose:
Represent current, next, or available lesson/class on Today.

Must show:

- Lesson/class name.
- Time/date if available.
- Student count if available.
- Attendance state.
- Primary CTA based on state.

CTA rules:

- `התחלת נוכחות` for not started.
- `המשך נוכחות` for in progress.
- `צפייה בסיכום` for completed.
- `סימון עכשיו` for missed/unmarked.

Primary CTA must be inside the card.

### LessonStatusBadge

Purpose:
Show the lesson attendance state.

States:

- `לא התחילה`
- `בתהליך`
- `הושלמה`
- `לא סומנה`

Rules:

- Must be readable on the card background.
- Do not reuse student status colors in a confusing way.

### StatsStrip

Purpose:
Show compact summary counts.

Used in:

- Today cards.
- Attendance session header.
- History cards.
- Completion summary.

Rules:

- Keep labels short.
- Use clear status colors.
- Must work in narrow mobile width.

### AttendanceStudentRow

Purpose:
Show one student during attendance.

Must show:

- Student name.
- Current status chip.
- Time if relevant.
- Note indicator if note exists.
- Optional secondary menu.

Rules:

- Compact enough for 25–30 students.
- Student name must be easy to scan.
- Do not show four large status buttons by default.
- Row tap opens StudentActionBottomSheet.

### StudentActionBottomSheet

Purpose:
Fast status changes and note editing.

Actions:

- `נוכח`
- `איחר`
- `נעדר`
- `מוצדק`
- `הוספה / עריכת הערה`

Rules:

- Must be easy to use with one hand.
- Status changes save immediately.
- Note editing should be clear but not dominate the main flow.
- Close after action unless note editing requires staying open.

### ExceptionsSegmentedControl

Purpose:
Switch between all students and exceptions.

Labels:

- `כל התלמידים`
- `חריגים בלבד`

Rules:

- Must sit above the student list.
- Must be visible without opening a menu.
- Selected state must be obvious.

### FinishAttendanceBar

Purpose:
Sticky bottom completion action during active attendance.

Must include:

- Primary button: `סיום נוכחות`.
- Compact summary counts.

Rules:

- Must be sticky at the bottom.
- Must not be hidden behind bottom navigation.
- Must respect mobile safe area.
- Must remain clear while scrolling long student lists.

### EmptyState

Purpose:
Explain what is missing and guide to the next action.

Must include:

- Clear title.
- Short explanatory text.
- Optional CTA.

Do not use generic `אין נתונים` without guidance.

### SecondaryActionMenu

Purpose:
Hold non-primary actions.

Examples:

- Edit.
- Deactivate.
- Delete.
- Import.
- Move student.
- Settings.

Rules:

- Secondary/admin actions should not visually compete with primary attendance actions.
- Destructive actions must be separated and confirmed where appropriate.

### SearchField

Purpose:
Search students or history.

Rules:

- Must work well in RTL.
- Placeholder should be short.
- Use adequate contrast.

## Consistency rules

1. Reuse components before creating new patterns.
2. Do not create new button styles unless the design system is updated.
3. Do not create new card styles unless the design system is updated.
4. Do not create new status colors unless the design system is updated.
5. Keep text short and action-oriented.
6. Prioritize teacher speed over decorative detail.

