# WO-064 · Design Board tiles disappear + selection sticks = DUPLICATE element IDs (nextId seeded from count, not max) · CW Jul 24
**Change ID:** pending #1 assign (DB-CORE) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/cch-design-board.js`. **Staging first; prod on Cindy GO.** This is THE cause of the "sticky / can't get through a board" reports. Data + code, grounded live.

## Proven live (prod RH Design Board "Powder Baths", build 9.9.27)
`dbEditor.elements` ids = [el_2, el_5, el_7, el_7, el_6, el_10, el_8, el_11, el_7, el_3]. **el_7 is used by THREE different tiles.** `dbEditor.nextId` = 11, max existing id number = 11, so the next tile added would be el_11 and collide again.

## Root cause (grounded)
- `genId()` @cch-design-board.js:46 = `'el_' + (dbEditor.nextId++)`.
- On board load @797: `dbEditor.nextId = dbEditor.elements.length + 1;`. After any delete, count < highest id, so the counter is seeded BELOW existing ids and genId() hands out ids that already exist. Repeated sessions accumulate duplicates (el_7 x3 here).
- Duplicate ids break every id-keyed lookup: `dbFindElementDomNode(id)` (@2404) returns the FIRST matching node, `dbLiftElementToFront`/`dbPatchElementDom`/`dbUpdateSelectionDom` all key by id. Result: the 2nd/3rd el_7 have no unique DOM node -> they do not render (**"tiles disappear"**); selecting sets `selectedId='el_7'` which matches 3 tiles so the gold grips latch onto the first and clicking the others does nothing (**"sticky selection"**). Unstick/Tidy cannot fix it because the collision is in the data, not the gesture.

## Change
1. **Seed nextId from MAX id, not count.** Replace @797 with a scan: `dbEditor.nextId = 1 + Math.max(0, ...elements.map(e => parseInt(String(e.id||'').replace(/^el_/,''),10) || 0))`. Guarantees new ids never collide regardless of deletions.
2. **Heal existing duplicates on load (one-time, idempotent).** After elements load, detect duplicate ids; for each extra occurrence, assign a fresh unique id via genId() (after step 1 seed). Preserve ALL element content (clipId, x/y/w/h, imageUrl, title, cost) — change only the internal `id`. Existing corrupted boards self-repair on next open + save.
3. **Make genId() collision-proof (defensive):** if the generated id is already present in `dbEditor.elements`, keep incrementing until unique.
4. Audit the other `elements.length` sites (@949, @975, @2167, @3193) to confirm none of them mint ids from length; if any do, route through genId().

## Acceptance (binary)
1. Open Powder Baths (RH): 0 duplicate ids; all 10 tiles render; selecting each of the previously-duplicated tiles moves the grips to THAT tile; Tidy keeps all 10 (none vanish); adding a new tile yields a unique id (el_12+), no collision.
2. A board with deletes then adds never produces a duplicate id.
3. No element is ever deleted or loses its clipId/content by the heal. Undo/save intact.

## Constraints
- Never split index.html. `cch-design-board.js` only. Design-board elements are self-contained (nothing external references el_N; clipId is separate and untouched). Behavior/data-integrity fix.

## Verify (Claude)
Staging: build a board, delete 2 of 5 tiles, add 3 -> confirm unique ids, no disappear, selection lands right. Prod: reopen Powder Baths after deploy, confirm el_7 x3 healed to unique ids and all tiles present. Screenshot ids + board to loop/verify/WO-064/.

## Immediate hotfix option (Cindy GO)
Cindy's live Powder Baths board can be de-duped now (reassign the 2 extra el_7 tiles to fresh ids, preserve content, save) so she can keep working before the code ships. Targeted, reversible, content-preserving.

## DONE note
loop/WO-064_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
