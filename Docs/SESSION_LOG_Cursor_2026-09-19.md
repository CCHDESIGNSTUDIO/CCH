# Session Log — Cursor: IN-10161 images + Manage drag (WO-241)

**File:** SESSION_LOG_Cursor_2026-09-19.md  
**Original Author:** Cursor (CR)  
**Created:** September 19, 2026  
**Last Modified:** September 19, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.5

## Revision history

- v1.5 (Sep 19 ~15:11, CR): Production hosting **9.9.358** Cindy GO — WO-244 + WO-242 + WO-241.
- v1.4 (Sep 19 ~14:10, CR): WO-244 Bill From full Vendors list including Workrooms. Studio **9.9.358**. Staging queued.
- v1.3 (Sep 19 ~14:04, CR): WO-243 IN-10161 drop July 17 Studio check; restore second Houzz ACH. Production Firestore. No hosting.
- v1.2 (Sep 19 ~14:00, CR): WO-242 PO At Workroom pick list / Ship To. Studio **9.9.357**. Staging queued.
- v1.1 (Sep 19 ~13:50, CR): WO-241 Invoice Manage ⋮⋮ drag dataTransfer. Studio **9.9.356**. Staging queued. Not production.
- v1.0 (Sep 19 ~13:24, CR): WO-240 tear sheets 9.9.355 production GO.

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Firebase:** production hosting **9.9.358** (WO-244 + 242 + 241, Cindy GO ~15:11). WO-243 was Firestore-only earlier.

## Session overview

Cindy adding photos on West Avalon IN-10161. Images were on the lines; Edit table lagged then painted. Then: cannot reorder on Manage.

## What changed

**WO-244.** Bill From lists all Vendors (Showrooms / Workrooms / Retailers / Other). Workrooms were skipped so OC Custom Furniture could not invoice as Bill From. Studio **9.9.358** staging queued.

**WO-243.** Cindy GO: IN-10161 July 17 $5k Check was Studio, not Vaughn. Restored second Houzz ACH `py_3T1ZR2…` dated 02/15/2026. Paid still $10,000. Invoice total / lines untouched.

**WO-242.** Cindy: At workroom asked her to type a workroom name. Now uses Ship To if set, else Vendors → Workrooms dropdown. Studio **9.9.357** staging queued.

**WO-241.** Manage `invoiceRowDragStart` now sets `dataTransfer` like Edit `docEditRowDragStart`. `ondragstart` passes `event`. Client View still has no reorder (by design).

## Open items

- Hard refresh IN-10161: two ACH $5,000 Feb 15, no July 17 Check.
- Production is **9.9.358**. Hard refresh: PO-9041 Bill from → Workrooms → OC Custom Furniture; At workroom uses Ship To/list; IN-10161 Manage drag.
- WO-237 still paused (void IN-12980 Selections ghosts).
- IN-10161 Houzz cost/markup not repaired unless Cindy names lines.
