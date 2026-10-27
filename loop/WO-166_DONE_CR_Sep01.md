# WO-166 DONE — Doc Edit: drag to reorder lines

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-01  
**Build:** Studio **9.9.310**

## Symptom (Cindy)

Document Edit (proposal / invoice / PO): only ▲▼ arrows on each line. "Why did you take away my ability to drag… I don't want to use arrows… you think I want to click 50 times."

## Surfaces

| Surface | This WO |
|---------|---------|
| Document **Edit** table (`docEditRenderItems`) — proposal, invoice, PO | **Yes** — ⋮⋮ drag handle + drop on row |
| Proposal Client/Manage landing (`proposalRowDragStart`) | **No** — already had drag |
| Print / PDF | **No** |
| PO Edit Vendor column | **No** — layout lock untouched |

## Grounding (this turn)

- Arrows were the only reorder UI: `platform/index.html` ~40826 (replaced).
- Swap-one-step: `docEditMoveItem` `index.html:41963`.
- Working drag pattern: `proposalRowDragStart` `index.html:11224`, drop splice `proposalRowDropOn` `index.html:11227`.
- Thead already labeled ⋮⋮ "Reorder lines" at `index.html:40713` but cells had arrows, not a handle.

## Root cause

Edit never had row drag. Reorder was ▲▼ (`docEditMoveItem` ±1). The column header showed a grip; the cells did not.

## Change

- Replaced ▲▼ with a draggable ⋮⋮ handle (`doc-edit-reorder-grip`).
- Drop on the line row (or a section banner) splices `_docEdit.items` in memory, then `docEditRenderItems` + `docEditAutoSave`.
- Bundle join matches proposal landing (`proposalInsertLineIntoExistingBundle`).
- ⋯ menu still has Move line up / down.

## Self-test

- Grep: `docEditRowDropOn`, `doc-edit-reorder-grip`, no remaining `docEditMoveItem` buttons in the expand cell.
- `CCH_BUILD` 9.9.310.
- Live browser: **not yet** — needs staging hosting. Verify after deploy: Edit a long PO/proposal, drag ⋮⋮, drop; line jumps; save persists.

## Verify (after staging)

1. Ctrl+Shift+R on `cch-platform-staging.web.app`
2. Orange STAGING banner, sidebar **v9.9.310**
3. Edit a proposal or PO with many lines — drag ⋮⋮ (left of + Notes), drop on another row
4. Reload Edit — order still there
5. Inputs still typeable (drag only from the grip, not from qty/name)
