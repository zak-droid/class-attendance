# Layout System — V2

## Main layout rule

Mobile-first. Hebrew RTL-first.

Design every screen first for a teacher using a phone during class.

Desktop can expand the same structure but should not drive the design.

## App shell

The app should use the dark premium visual shell from the design system.

Common structure:

1. Top header / identity area.
2. Main content area.
3. Bottom navigation, except where an active attendance sticky action conflicts.

## RTL rules

- Hebrew text is right-aligned by default.
- Icons should respect RTL reading order.
- Search icons in RTL fields should appear on the visually appropriate side for the implementation.
- Numbers, dates, and times may remain in standard numeric order.
- Use `dir="auto"` where content can mix Hebrew and English.

## Today screen layout

Order:

1. Header: `היום` + date.
2. Short teacher-focused context line.
3. Main current/next lesson card.
4. Today's other lessons/classes.
5. Missed/unmarked items if relevant.

The main lesson/class card must include the primary CTA inside the card.

Primary CTA placement:

- Full-width or highly prominent within the relevant card.
- Not only in top bar.
- Not hidden in a menu.

## Attendance session layout

Order:

1. Header with class/lesson name and date/time.
2. Compact summary strip.
3. Instruction message after starting:
   `כל התלמידים סומנו כנוכחים. סמנו רק חריגים.`
4. Segmented control:
   `כל התלמידים | חריגים בלבד`
5. Compact student list.
6. Sticky bottom finish area.

## Sticky finish action

During an active attendance session, the bottom action is more important than global navigation.

Sticky bottom area includes:

- `סיום נוכחות` primary button.
- Compact status summary.

If bottom navigation conflicts with the sticky finish action:

- Hide bottom nav during active attendance, or
- Reduce it, or
- Add enough safe-area spacing so the finish action remains clear.

Do not put `סיום נוכחות` only at the top of the screen.

## Student row/card layout

Rows should be compact and scannable with 25–30 students.

Each row/card should include:

- Student name as the strongest element.
- Current status badge.
- Optional time.
- Optional note indicator.
- Optional secondary menu.

Do not show four large status buttons on every row by default.

Tapping the row opens a bottom sheet/action panel.

## Bottom sheet/action panel

Use for quick student status changes.

Actions:

- `נוכח`
- `איחר`
- `נעדר`
- `מוצדק`
- `הוספה / עריכת הערה`

The sheet should be easy to use with one hand.

## Students screen layout

Purpose: quick lookup, not heavy admin.

Order:

1. Header: `תלמידים`.
2. Search field.
3. Optional class filter.
4. Student list/cards.
5. Secondary admin actions lower on the screen or in More.

Bulk import, delete, and moving students should not visually dominate this screen.

## History screen layout

Use mobile-friendly cards, not a wide table.

Order:

1. Header: `היסטוריה`.
2. Filters: date, class, student if useful.
3. Summary counts.
4. Attendance/session cards.

Each card should show:

- Date/time.
- Class/lesson.
- Summary counts.
- Key exceptions.

## More/Admin layout

More can contain:

- Class management.
- Import students.
- Settings.
- Export/admin actions.
- Future teacher/admin separation.

More is secondary to the teacher's daily flow.

## Button hierarchy

### Primary buttons

Use for one main action per screen/card:

- `התחלת נוכחות`
- `המשך נוכחות`
- `סיום נוכחות`
- `שמירה`

### Secondary actions

Use lower emphasis or menus:

- Edit.
- Delete.
- Deactivate.
- Import.
- Move.
- Advanced settings.

### Destructive actions

Never place destructive actions next to the primary attendance action without clear separation and confirmation.

## Empty states

Every empty state must guide the user to the next useful action.

Avoid generic text like `אין נתונים` without explanation.

