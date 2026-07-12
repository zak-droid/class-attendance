# Attendance App V2 Source Docs

These files are the source of truth for the Teacher-first V2 attendance app.

Before making any V2 product, UX, layout, or visual change, Codex must read this folder first.

## Files

- `PRODUCT_PRINCIPLES.md` — what the product is and what it is not.
- `TEACHER_WORKFLOW.md` — the teacher's ideal daily flow and edge cases.
- `LAYOUT_SYSTEM.md` — screen structure, button placement, navigation, and mobile layout rules.
- `DESIGN_SYSTEM.md` — visual direction, palette, typography, logo usage, status colors, and design rules.
- `COMPONENT_RULES.md` — reusable component behavior and consistency rules.
- `CODEX_V2_IMPLEMENTATION_PROMPT.md` — the implementation prompt to use after these docs are added to the repo.

## Mandatory rules for Codex

1. Do not invent new UX patterns unless explicitly asked.
2. Do not invent new colors, typography, spacing, or component styles unless explicitly asked.
3. If a requested change conflicts with these docs, say so before implementing.
4. If a new pattern is needed, update the relevant source doc in the same commit.
5. Preserve Hebrew RTL quality.
6. Preserve the existing working V1 before V2 implementation begins.
7. V2 should be implemented on top of the existing app, not as a rebuild from scratch.

## Recommended repo location

Place this folder in the app repository as:

```text
/docs/v2/
```

## Standard instruction for future Codex prompts

```text
Before making changes, read and follow all files in /docs/v2/.
Do not introduce new product flows, layout patterns, colors, typography, or component styles unless explicitly requested.
```

