# WO-050-B DONE — Collapsible sections
**File:** WO-050-B_DONE_CR_Jul22.md · **State:** DONE-UNVERIFIED · **Attempts:** 1  
**Change ID:** FT-012 · **Executor:** Cursor Builder Jul22

## Files touched
- `platform/builder/index.html`
  - `BUILDER_SECTION_COLLAPSE_KEY` = `builderSectionCollapse` localStorage map
  - `loadBuilderSectionCollapseMap` / `persistBuilderSectionCollapseMap` / `builderSectionIsOpen` / `bindBuilderSectionToggle`
  - `wrapFormCollapsible` + `saveFormSectionOpenState` persist open/closed
  - Project Info, Details & Trim, Measurements, Workroom costs, leftover pickers wrapped
  - Defaults: Project Info / Design intent / Design specs / Materials / Notes = open; Rendering / Details / Measurements / Workroom / pickers = collapsed
  - Toggle does not call Firestore save (localStorage only)

## Self-test
- Toggle persistence via localStorage key `builderSectionCollapse`
- Header Save bar unchanged (always available when signed in)

## Queue
Batched staging with WO-049-B / 051-B.
