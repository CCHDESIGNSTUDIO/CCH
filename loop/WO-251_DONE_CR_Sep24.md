# WO-251 DONE — edit line items table fits the window

Cindy Sep 24. While editing, the page stayed too wide and she could not see the whole row.

## Surfaces

- Affects: Edit line items for proposals, invoices, and purchase orders (`docEditRenderItems` / `.doc-edit-table`).
- Does not affect: print/PDF, the proposal view table (`#proposalPrintArea`), or the PO list (`#posTable`).
- PO Edit still has Finish and Ship to. No Vendor column on POs.

## Files

- `platform/index.html` `.doc-edit-table` ~2981. Removed `min-width: 980px`. Table is `width: 100%` and `table-layout: fixed`.
- `platform/index.html` `docEditRenderItems` thead ~41323. Column widths are percentages that sum to 100%, so the row stays inside the window. Item names wrap.
- `platform/index.html` `.doc-edit-room select` ~3071. Room dropdown no longer forces a 140px minimum.
- `platform/index.html` `CCH_BUILD` ~4378. `9.9.364` / `doc-edit-fit`.

## Self-test

Column percentages add to 100 for a proposal/invoice row (15 columns) and a PO row (13 columns). File tail is `</html>`. Not checked in the browser — this build is not deployed.
