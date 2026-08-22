# WO-058 · Removing an item from a room board must default to UN-ASSIGN ROOM (keep in Selections), and the room-clear must be Houzz-proof so deleted items stop coming back · CW Jul 23 (rev)
**Change ID:** pending #1 assign (SYNC-SAFETY) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.** BLOCKS the WO-045 production apply. Family: WO-045/055/056/057.

## What Cindy said (Jul 23)
"I keep declining old items from Houzz on the room boards or hiding them. I've had to do it 10 times." Then, sharper: "it's more if it was clipped with a room, that room stays with the item in Selections. That's probably why they keep coming back. So maybe the answer, instead of delete, is just default to 'no room selected'."

## Root cause (grounded, index.html) — Cindy's diagnosis confirmed
- **The ROOM on the item is the fuse.** Every clip-ensure pass creates a room-board clip only when the item has a room. `_selEnsureClipsForProjectProducts` (@16907): `var room = String(p.room||'').trim(); if (!room) continue;` then adds a clip. `cchEnsureClipsFromDocLines` (@12577, the WO-045 doc-line sync) same shape. Strip the room and there is nothing to re-create.
- **Delete is destructive AND its room-clear is brittle.** `deleteClip` (@76939) hard-deletes the clip, then `_clearCatalogRoomForRemovedClip` (@76934) nulls `room` on `products`/`productLibrary` matching by libId OR by EXACT lowercased title+vendor+room. Houzz imports break that exact match: dupe rows with slightly different title/vendor, and rows that copied a CATEGORY into the room field (code even flags this: `_cchKnownFfeCategoryLower`, "Legacy Houzz rows often copied category e.g. 'Lighting' into clip.room"). Any row it misses keeps its room and re-spawns.
- **The correct action already exists but is not the default.** `removeClipFromRoomBoard` (@76979) sets clip `room:''`, keeps the item in Selections ("the item stays in Selections with no room assigned"), and calls the same catalog clear. That IS Cindy's no-room answer; it just sits next to a destructive Delete and shares the brittle clear.
- **Note:** `_doNotReuse` (@18521) is never set and being excluded from the dedup index makes the sync CREATE, not skip. Do not lean on it.

## Change
1. **Default the room-board removal to UN-ASSIGN ROOM, not delete.** The primary/obvious action on a room-board clip becomes "Remove from room" = set `room:''`, keep the clip and the Selections entry. Make `deleteClip` (permanent product removal) the secondary, clearly-labeled destructive action, not the default a mis-click lands on.
2. **Make the room-clear Houzz-proof.** Rewrite the catalog room-clear so un-assigning clears the room on EVERY row that could feed a clip-ensure pass for this product in this project: match by libId, AND by normalized title+vendor across the project REGARDLESS of the stored room value (do not require the room to match, so dupes and category-in-room rows are all caught). Clear room on the clip, on `products`/`productLibrary`, and on any Selections row. Nothing that represents this product in this project is left carrying a room.
3. **Treat category-as-room as no room in every spawn pass.** In `_selEnsureClipsForProjectProducts` and `cchEnsureClipsFromDocLines`, before creating, if the row's room is empty OR `_cchKnownFfeCategoryLower(room)` is true, SKIP (no clip). Bogus "Lighting"-style rooms must never spawn a board.
4. **Belt for the doc-line case (keep, narrowed).** If the removed product is ALSO on a roomed proposal/invoice/PO line, that line's room legitimately stays for pricing, so clearing it is wrong; instead write a lightweight suppression `boards/{projectId}/clipSuppressions/{key}` (key = libId+'|'+roomLower, else title+'|'+vendor+'|'+roomLower) that `cchEnsureClipsFromDocLines` consults and SKIPS, counted as `skippedSuppressed` in the dry-run. A deliberate re-add of that product to that room clears the suppression. This only matters when a doc line is involved; the no-room default (steps 1-3) handles plain Selections/Houzz clips.
5. **Decline/Hide unchanged.** Decline (`clientSelectionStatus:'declined'`) and Hide (`hiddenFromRoomBoard`) are soft flags; the clip stays and the sync dedups against it. Do not tombstone or clear room on those. Leave as is.

## Acceptance (binary)
1. On staging, a Houzz-style clip (no libId, dupe rows, some with category-in-room) is on a room board. Use "Remove from room" -> the clip leaves the board, stays in Selections with no room, and after running every clip-ensure pass it does NOT come back.
2. The same works even when the underlying import left 2-3 dupe product rows: none of them re-spawns (room cleared on all).
3. A row whose "room" is actually a category ("Lighting") never spawns a board clip.
4. If the product is also on a roomed draft proposal line, removal suppresses re-create (dry-run shows skippedSuppressed, not wouldCreate); re-adding to that room clears it.
5. Decline and Hide behave exactly as today. No console errors. Proposal/invoice/PO line rooms are not mutated.

## Constraints
- Never split index.html. Escaped onclick pattern. Only new write is the `clipSuppressions` subcollection; financial doc lines untouched. Respect `boardClipWriteAllowedForRoomBoard` + frozen-project guards.
- Coordinate with WO-045 (`cchEnsureClipsFromDocLines`) and WO-056 (Selections add clears suppression). Do not double-patch the create path.

## Verify (Claude, staging)
Remove a roomed Houzz-style clip (with dupe rows) via "Remove from room", run the ensure passes, confirm it stays gone and stays in Selections; confirm a category-in-room row never spawns; confirm the doc-line suppression case. Screenshots to loop/verify/WO-058/.

## GATE
WO-045 production apply stays BLOCKED until WO-058 lands + verifies on staging, OR a read-only production dry-run confirms no `wouldCreate` entry matches an item Cindy deleted. Dry-run does not write.

## DONE note
loop/WO-058_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
