# WO-235 DONE — RH Large Rec Glass Lantern library ID

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-18  
**Change ID:** data (no hosting)

## Symptom

Cindy Sep 18 Cloud Rolling Hills Selections: **Large Rec Glass Lantern sconce** showed “No Houzz or library ID”. It is on **PRO-3025** and **INV-6067**. She also deleted a Selections row and worried it was on a doc.

## Grounding (this turn)

- Badge text `index.html:65309` — needsId when clip has no houzzId and no libraryProductId.
- Clip `y1225j48vzeYDheN0BXm` source `proposal`, libraryProductId empty, houzzId empty. Linked `proposalId` QdIB3AClnotrP9YgBLTs / PRO-3025.
- PRO-3025 items[1] and INV-6067 items[1] also had empty `libraryProductId`; both `clipId` = that clip.
- Library already had the product: `products/gWPgnpfAdJXlcjVlwRUq` (title match, houzz **54545585**, vendor Elu, category Lighting).
- INV-6067 all **12** clipIds still exist — delete was not an invoice lighting line.

## Change

Stamped **only identity** on clip + sent proposal line + sent invoice line:

- `libraryProductId` / `linkedLibraryProductId` = `gWPgnpfAdJXlcjVlwRUq`
- `houzzId` = `54545585`
- docs: `libraryProductIdLocked: true`

Qty 2, cost $2,150, amount $5,160 unchanged.

Backup: `_backup/wo235-large-rec-libid-2026-09-18T22-14-11-111Z/`

## Verify

Hard refresh `https://cch-platform.web.app/#/project/cloud-rolling-hills/selections` — Large Rec row should show Houzz / Lib ids. PRO-3025 and INV-6067 Edit line: Library product id `gWPgnpfAdJXlcjVlwRUq`.
