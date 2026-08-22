# WO-055 · Add-item panel: allow adding a product that's ALREADY on the proposal (same item, multiple rooms) · CW Jul 23
**Change ID:** pending #1 assign (PROP) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.** Direct sibling of WO-045 ("same item can go in different rooms").

## What Cindy said (Jul 23, PRO-3037 Rolling Hills)
"I need to be able to add a product multiple times for multiple rooms. You can't gray out the products. I thought we resolved this." The Add-item sidebar grays out anything already on the proposal ("Already on this document, edit in the table") and blocks re-adding, so the same slab can't go in a second room.

## Root cause (grounded, index.html)
- The Add-item sidebar builds `window._disProposalExcludeKeys` @39879-39889 from the proposal's existing `items[]`: for each line it adds `clip:{clipId}`, `lib:{libraryProductId}`, and `tv:{selDupKeyForItem(title,vendor)}`.
- Those keys drive the "already on this document" **disabled / grayed** state in the sidebar render (text at @33540 / @37950; sidebar built via `filterDocSidebar` @40019) and the bulk `libraryRailAppendAllRoomBoardClips` (@~39662) explicitly "Lines already on this proposal are skipped."
- Net: an item already on the doc is treated as non-addable. That contradicts the locked rule that the SAME product legitimately appears on multiple lines for multiple rooms.

## Change
1. **Manual single-add must always be allowed.** An item matching an exclude key stays fully clickable in the Add-item sidebar; clicking it **adds a NEW proposal line** for that product (same as a first add), never a no-op and never disabled/grayed to unusable.
2. **Replace the block with an informational badge.** Instead of "Already on this document, edit in the table" as a disabled state, show a subtle "On this doc x N" chip so Cindy knows it's already used, without preventing re-add.
3. **De-fang the `tv:` (title+vendor) key** for blocking, it's the coarsest and most likely to over-match near-identical names; it must never hard-block a re-add. (`clip:`/`lib:` keys can still inform the badge count.)
4. **New line inherits the product** (title, vendor, cost, markup, images, sku, finish, category) exactly like a normal add; **room defaults blank** so Cindy assigns the new room. Keep `clipId`/`libraryProductId` linkage consistent with a fresh add (per WO-045 each product+room is its own line; a shared clipId across rooms is fine, or blank, matching current fresh-add behavior).
5. **Bulk "Pull full room board"**: keep skipping already-on by default to avoid mass duplicates (that path is a bulk convenience, not the multi-room use case). If Cindy wants bulk to allow dupes too, that's a one-line follow-up; default = bulk still skips, manual always allows.

## Constraints
- Never split index.html. Escaped onclick attribute pattern (no quote-collision bug). Behavior/display change only, no data-model change.
- Check for overlap with WO-049..054 (other sessions) before editing; if one already touches this sidebar, coordinate, don't double-patch.

## Acceptance (binary)
1. On a proposal that already contains Product X, opening Add item shows X still clickable (not grayed/blocked), with an "on this doc" badge.
2. Clicking X adds a SECOND line for X; that line can be set to a different room; both lines persist and render in the table.
3. Same works from Project Selections and Products tabs. Bulk "Pull full room board" unchanged (or per Cindy). No console errors.

## Verify (Claude, staging)
On a staging proposal, add the same product to two different rooms via the Add-item panel; confirm two lines, each with its own room. Screenshot to loop/verify/WO-055/.

## DONE note
loop/WO-055_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
