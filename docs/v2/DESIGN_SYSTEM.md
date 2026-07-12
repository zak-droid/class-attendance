# Design System — Attend Academy / Attendance V2

## Reference model

The provided Attend Academy / deep blue reference is the primary visual model for V2.

Do not treat it as loose inspiration.

Use it as the source of truth for:

- Overall visual mood.
- Dark premium mobile app feeling.
- Deep blue-teal palette.
- Tonal layering.
- Card treatment.
- Navigation feeling.
- Logo usage.
- Contrast and depth.

## Visual direction

V2 should feel like a premium dark teacher workflow app.

It should not look like:

- A generic SaaS dashboard.
- A basic admin panel.
- A pastel education template.
- A light app with only teal buttons.

The app should be visually close to the provided dark reference while staying readable for teachers during real use.

## Core palette

These are the true primary colors.

```yaml
colors:
  primary: '#002B45'
  secondary: '#005580'
```

### Usage

| Token | Color | Usage |
|---|---:|---|
| Primary | `#002B45` | Main app shell, background, top areas, deep cards, identity surfaces |
| Secondary | `#005580` | Elevated cards, active areas, important containers |
| CTA | `#00A6A6` | Primary actions where more contrast is needed |
| CTA Hover/Active | `#00B3A4` | Active/pressed CTA states |
| Text on dark | `#FFFFFF` | Main text on dark backgrounds |
| Muted text on dark | `#B8D8E6` | Secondary text on dark backgrounds |
| Dark text | `#0F172A` | Main text on light surfaces |
| Muted dark text | `#475569` | Secondary text on light surfaces |
| Light surface | `#F4F8FA` | Light work areas when needed for readability |
| White surface | `#FFFFFF` | Inputs, expanded rows, cards requiring maximum readability |
| Dark border | `rgba(255,255,255,0.14)` | Borders on dark surfaces |

## Important palette rule

`#002B45` is not just a button color.

It is the app's main visual foundation.

`#005580` is the second layer for cards, raised containers, and active sections.

Do not drift back to generic green-teal or pale SaaS colors.

## Status colors

Status colors must be instantly recognizable and should not be over-styled to match the palette.

| Status | Hebrew | Color | Light chip background | Text on chip |
|---|---|---:|---:|---:|
| Present | נוכח | `#16A34A` | `#DCFCE7` | `#166534` |
| Late | איחר | `#F59E0B` | `#FEF3C7` | `#92400E` |
| Absent | נעדר | `#DC2626` | `#FEE2E2` | `#991B1B` |
| Excused | מוצדק | `#2563EB` | `#DBEAFE` | `#1E40AF` |
| Unknown / Not handled | לא ידוע / לא טופל | `#64748B` | `#E2E8F0` | `#334155` |

Absence must read as red. Lateness must read as amber/orange. Do not make these too blue.

## Typography

### Hebrew UI

Use Heebo as the primary Hebrew UI font.

```css
font-family: Heebo, "Noto Sans Hebrew", "Segoe UI", Arial, sans-serif;
```

### English / logo / optional Latin support

Hanken Grotesk may be used for the logo, English brand text, or Latin-only brand material.

Do not use Hanken Grotesk as the main Hebrew UI font.

## Type scale

| Role | Size | Weight | Usage |
|---|---:|---:|---|
| Screen title | 24–28px | 700 | Main page title |
| Card title | 18–20px | 700 | Lesson/class title |
| Body | 15–16px | 400–500 | Normal UI text |
| Student name | 16px | 600 | Student rows |
| Label | 12–14px | 500–600 | Chips, metadata, buttons |
| Large number | 28–36px | 700–800 | Summary stats |

Hebrew often needs slightly stronger weight for equivalent presence.

## Logo usage

The Attend Academy logo direction is approved as a strong V2 direction.

### Logo strengths

- The A mark works for Academy / Attendance.
- The check mark connects clearly to attendance.
- The logo fits the dark premium academic style.
- The mark works well on the primary background.

### Required checks

Before final use, verify:

1. The icon mark is readable at small sizes.
2. The check mark is visible inside the A mark.
3. The full logo works on `#002B45`.
4. The icon-only version works as favicon/app icon/header mark.
5. The logo does not become blurry or overly detailed at mobile sizes.

### Logo placements

- Full logo: login/welcome screen, splash, major brand moments.
- Icon mark: app header, favicon, app icon, compact navigation.
- Do not overuse the full logo inside working screens.

## Surfaces and depth

Depth is created through tonal layers, not heavy shadows.

Recommended layering:

1. Base shell: `#002B45`.
2. Raised card: `#005580`.
3. Active/CTA: `#00A6A6` where needed.
4. Readability surface: `#F4F8FA` or `#FFFFFF` only where text-heavy work requires it.

Cards on dark backgrounds should use subtle borders:

```css
border: 1px solid rgba(255,255,255,0.14);
```

## Shapes

Use a rounded, modern app feel.

| Element | Radius |
|---|---:|
| Small chips | 9999px |
| Inputs | 10–12px |
| Student rows/cards | 14–16px |
| Lesson cards | 18–24px |
| Bottom sheets | 24px top corners |
| Bottom nav | 24–9999px depending on shape |

## Spacing

Mobile spacing should be generous enough to feel premium but not wasteful.

| Token | Value |
|---|---:|
| Screen horizontal padding | 20px |
| Card internal padding | 16px |
| Dense row padding | 12–14px |
| Card gap | 12px |
| Section gap | 20–24px |
| Minimum touch target | 44px |

## Navigation

Bottom navigation should feel integrated into the dark premium style.

Approved directions:

- Floating dark/blue nav.
- Glass-like dark nav with high readability.
- Strong active state using secondary/CTA color.

Avoid:

- Generic white bottom nav unless explicitly approved.
- Pale inactive icons with poor contrast.
- Navigation that competes with the sticky Finish Attendance action.

## Buttons

### Primary CTA

Use for the main action only.

Examples:

- `התחלת נוכחות`
- `המשך נוכחות`
- `סיום נוכחות`
- `שמירה`

Primary CTA should be highly visible on the current surface.

If placed on `#002B45` or `#005580`, use `#00A6A6` or a high-contrast approved style.

### Secondary buttons

Use lower emphasis for:

- Edit.
- Import.
- Settings.
- Filters.
- Navigation to admin actions.

### Destructive buttons

Use red, separated from primary actions, and require confirmation where appropriate.

## Inputs

Inputs can be dark or light depending on context.

For working/search-heavy screens, prioritize readability.

Search fields should be easy to find and usable in RTL.

## Do not do

- Do not redefine Primary as `#a8caeb` or any light blue.
- Do not use Hanken Grotesk as the Hebrew UI font.
- Do not introduce a new palette without approval.
- Do not make status colors ambiguous.
- Do not make student names hard to read in the name of style.
- Do not turn V2 into a generic admin dashboard.

