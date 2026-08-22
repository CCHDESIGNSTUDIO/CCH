# WO-056 · Selections "Add to room" must DUPLICATE into the new room (new clip id), not MOVE the existing clip · CW Jul 23
**Change ID:** pending #1 assign (SEL) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.** Completes the "same product, different rooms" model with WO-045 + WO-055.

## Why
Model (locked, WO-045): identity = **product + room**; two rooms = two clip documents, each carrying its own room. Today, adding a product to a second room from Selections **relocates the existing clip** (changes its room) instead of creating a second clip id (grounded by Cursor ~index.html:39313-39347). That fights multi-room: the product leaves the first room instead of appearing in both.

## Change
1. **Selections "Add to room" (and any room-assign that currently moves a clip):** when the target room differs from the clip's current room AND the clip is already roomed/used, **create a NEW clip** for (product, target room) rather than mutating the existing clip's `room`. Reuse the WO-045 create path (`cchEnsureClipsFromDocLines` / `_selEnsureClipsForProjectProducts`) so the new clip inherits product data (title, vendor, cost, images, sku, finish, category) and gets its own id.
2. **Never silently relocate** a clip that's already on a board/doc to a different room. Moving is only valid when correcting an unroomed or wrongly-roomed clip that isn't yet duplicated; when in doubt, duplicate.
3. Dedup guard: if a clip for (product, target room) already exists, link/no-op instead of making a third duplicate (same product+room index as WO-045: `_disResolveClipIdFromIndex(..., room)`).
4. Pairs with WO-055 (Add-item panel re-add) so both the proposal side and the Selections side allow the same product across rooms.

## Constraints
- Never split index.html. Escaped onclick pattern. Respects `boardClipWriteAllowedForRoomBoard` + frozen-project guards. Behavior change only.
- Coordinate with WO-045 (`cchEnsureClipsFromDocLines`) so the two create paths share dedup logic and don't double-create.

## Acceptance (binary)
1. Product X is on the Kitchen board. From Selections, add X to Exterior -> X now exists on BOTH Kitchen and Exterior as two separate clip ids; the Kitchen clip is unchanged.
2. Adding X to Exterior a second time does not create a third clip (dedup by product+room).
3. No existing clip's room is silently changed by an add-to-room action. No console errors.

## Verify (Claude, staging)
On staging, add one product to two rooms via Selections; confirm two clips, original room intact. Screenshot to loop/verify/WO-056/.

## DONE note
loop/WO-056_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
