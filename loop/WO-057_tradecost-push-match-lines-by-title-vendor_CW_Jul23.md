# WO-057 · Trade-cost push reaches nothing on a draft proposal / Selections — match unlocked LINES by title+vendor (not just libraryProductId) + heal stale usage refs · CW Jul 23
**Change ID:** pending #1 assign (COST) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/cch-cost-lock.js` (+ index.html glue). **Staging first; prod on Cindy GO.** Same linkage gap as WO-045/056/Peek-Can, hitting the trade-cost push.

## What Cindy said (Jul 23)
"Update trade cost on all unlocked linked items" for **Cafe Milk Crackle Demi Bullnose** (DNET $6.06) reported **WILL UPDATE (0)** and **6x "Could not load linked doc"**, even though the item is on a **draft proposal** (unlocked) and in **project Selections**. "This push feature is not working. It should push to project selections and the proposal because it is still draft mode."

## Root cause (grounded, cch-cost-lock.js)
- **LINE matching is by libraryProductId ONLY.** `cchFallbackScanProjectsForLibraryId` (~424) matches proposal/invoice/PO lines with `lineHasLibraryId(line, libId)` = `line.libraryProductId === libId`. A draft line added WITHOUT a library link (no `libraryProductId`) is invisible to the push.
- **Clips get a title+vendor fallback, lines do not.** `cchScanClipsByTitleVendor` (~384) catches unlinked CLIPS by title+vendor; there is no equivalent for LINES.
- **The 6 "Could not load linked doc"** (@346) are stale `libraryUsageRefs` whose `db.collection('boards').doc(projectId).collection(coll).doc(docId).get()` throws. They are skipped but never pruned, so they keep surfacing.
- Net: the push finds neither the draft proposal line (no libId link, no title+vendor line fallback) nor cleans up the stale refs.

## Change
1. **Add a title+vendor fallback for LINES**, mirroring `cchScanClipsByTitleVendor`: `cchScanLinesByTitleVendor(pid, title, vendor, libId, addTarget)` that scans `proposals` / `invoices` / `purchaseOrders` and matches UNLOCKED lines by normalized title (+ vendor when present) even when `libraryProductId` is absent. Call it in the `doDeep` block next to the clip title+vendor scan (~386).
2. **Respect locks:** only unlocked targets — draft proposal lines yes; sent POs, locked/paid invoices, and cost-locked lines still skipped (reuse `cchDocLineCostLockReason`). Confirm a DRAFT (not-sent) proposal line is treated as UNLOCKED so it lands in WILL UPDATE.
3. **Heal forward:** when a line/clip is matched by title+vendor and has no `libraryProductId`, stamp the link on apply (only on an unambiguous single-library match) so the next push finds it by id — closes the gap going forward (pairs with the WO-045/056 auto-link model).
4. **Prune stale refs:** when a `libraryUsageRefs` entry throws or resolves not-exists, mark it stale and remove it from the product's `libraryUsageRefs` on apply, so "Could not load linked doc" stops accumulating.

## Acceptance (binary)
1. Cafe Milk Crackle on a DRAFT proposal + a Selection clip (both at a different cost) — the push lists BOTH under WILL UPDATE and applies $6.06 to both, even when the line has no `libraryProductId` (matched by title+vendor).
2. Sent POs / locked-or-paid invoices / cost-locked lines are still skipped correctly.
3. After apply, the stale refs are pruned; no "Could not load linked doc" remains for valid targets.
4. Draft proposal lines are never treated as locked. No console errors.

## Constraints
- `cch-cost-lock.js` + minimal index.html glue. Never split index.html. Escaped onclick pattern. Financial data — dry-run count in the modal (WILL UPDATE / SKIPPED) before Apply, as today.
- Coordinate with WO-045/056: the durable fix is auto-stamping `libraryProductId` when a library product is added to a proposal/clip; this WO makes the push resilient to missing links NOW and heals them on apply.

## Verify (Claude, staging)
On a staging draft proposal with a library product line (no libId link) + a selection clip, set a new library trade cost, push, confirm both update and the link gets stamped. Screenshot to loop/verify/WO-057/.

## DONE note
loop/WO-057_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
