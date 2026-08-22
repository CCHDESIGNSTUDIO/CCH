# WO-055 VERIFY — PASS · staging v9.8.108 · CW Jul 23
**Verifier:** Claude (Cowork), staging UI + console, cindy@cchdesign.com. Project cloud-rolling-hills, proposal PRO-3019 (draft, docId 6srlPMjBqw91qDx75S3D).

## Test
PRO-3019 had 1 line: Emtek "Modern Cabinet Hardware... Flush Pull" (MyKnobs), room Kitchen. Opened Add item.
1. The product ALREADY on the proposal appears at the top of "IN THIS PROJECT — SELECTIONS", header reads "CLICK AGAIN FOR ANOTHER ROOM". It is fully clickable, NOT grayed/blocked. (Criterion 1 PASS.)
2. Clicked it -> toast "Added: Modern Cabinet Hardware..."; a SECOND line was created for the same product with a blank Room dropdown. Now "2 product lines / 2 rows". (Criterion 2 PASS.)
3. Set line 2 room to "Bar" (different from line 1 "Kitchen"). Auto-save persisted. Firestore proposal now stores two items: {Kitchen, qty4} and {Bar, qty1}. Same product, two rooms, both persist. (Criterion 2 complete.)

## Verdict: PASS. The multi-room add (same item, multiple rooms) works on staging 9.8.108.
Staging restored: removed the test Bar line; PRO-3019 back to its single Kitchen line.
