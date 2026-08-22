# WO-043 · Selections → Library image sync + stop empty bulk-cost modal · CW Jul 15
**State:** DONE-UNVERIFIED · **Executor:** Cursor · **Staging first**

## Problem
Editing trade cost in **Selections** updated the linked library row’s price, but **did not copy the clip image** to the library when the library row had no thumbnail. User also kept seeing **“No unlocked targets need this cost”** modal after every save even when there was nothing to bulk-push.

## Root cause
- `_cchResolveAndSyncClipToLibrary` only synced `costPrice`, not `imageUrl` / `images`.
- `cchOfferTradeCostBulkUpdate` always opened the bulk modal (`forceModal: true`) even with 0 eligible targets.

## Fix
- `_cchResolveAndSyncClipToLibrary`: push image to library when clip has image and library row is blank (force on Selections saves).
- `saveProduct` clip path: pass `imageUrl`, `images`, `heroImageIndex` into sync.
- `cchOfferTradeCostBulkUpdate`: build plan first; toast + return when 0 eligible (no empty modal).
- Patch in-memory `libraryProducts` cache after sync; refresh library list if user is on `#/library`.

**Build:** v9.8.69 staging
