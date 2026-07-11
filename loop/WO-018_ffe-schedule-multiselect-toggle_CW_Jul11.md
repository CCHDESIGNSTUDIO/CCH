# WO-018 · FFE Schedule: make the Projects/Category/Status pickers click-to-toggle (polish on WO-014) · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Small refinement to the freshly-built FFE Schedule (`renderAllFFE`, `#/allffe`). No data change.

## What Cindy said (Jul 11, on the live FFE Schedule)
"Picker doesn't let me pick something from each section — only one at a time. Probably not a big deal —
looks great!" She's happy with the page; this is a usability nit on the three multi-select boxes.

## Cause
The PROJECTS / CATEGORY / STATUS controls are native `<select multiple>`. Native multi-selects only add to a
selection with **Cmd/Ctrl-click**; a plain click replaces it. Cindy (reasonably) expects click-to-toggle, and
the "(MULTI)" label sets that expectation.

## Change
Make all three lists **click-to-toggle** so multiple values can be picked with normal clicks, and values can
be combined across the three sections. Two acceptable approaches — prefer the first for consistency:
1. **Checkbox lists (preferred).** Replace each `<select multiple>` with the SAME checkbox-list pattern
   already used by the ITEM PROPERTIES (columns) row on this page — a scrollable list of checkboxes, one per
   option, plus an "All" checkbox that selects/clears the rest. Visually match that row (navy/gold, no gray).
2. **Toggle-on-click (lighter).** Keep `<select multiple>` but add an `onmousedown` handler per option that
   toggles `option.selected` and calls `event.preventDefault()` (the standard snippet) so a click adds/removes
   without needing a modifier key, and doesn't collapse the selection.

Behavior in both:
- "All …" is a real toggle: choosing it clears the specific picks (means "no filter / include everything");
  choosing any specific value unchecks "All".
- The current read-of-selection on **Apply** must keep working (collect all selected projects/categories/
  statuses). Don't change the query logic, only the input control.
- Keep it keyboard-accessible (checkboxes get this for free).

## Constraints
- Only the three FFE Schedule filter controls change; do not touch the Apply/query logic, the column picker,
  or the table. Navy/gold, no gray; never split index.html; `node --check` + tail after edit.

## Acceptance (binary)
1. On FFE Schedule, clicking multiple Projects (and multiple Categories, and multiple Statuses) with plain
   clicks selects all of them — no Cmd/Ctrl needed.
2. "All" toggles correctly against the specific picks in each section.
3. Apply still returns the union/intersection it did before (multi-project + multi-category + multi-status
   query unchanged).
4. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
FFE Schedule: plain-click 2 projects + 2 categories + 1 status, Apply, confirm the result reflects all picks;
screenshot to loop/verify/WO-018/.

## DONE note
loop/WO-018_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
