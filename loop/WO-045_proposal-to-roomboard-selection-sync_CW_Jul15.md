# WO-045 · Reverse-sync: proposal/invoice line → Room Board + Selections clip (product + room) · CW Jul 15
**Change ID:** pending #1 assign (SYNC) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging ONLY, DRY-RUN first; prod on Cindy GO.**

> **Numbering note:** Cowork drafted this as WO-045, but **WO-045 is already taken** (Design Board resize grips — PROD Jul 15). This order is **WO-045**.

## What Cindy said (Jul 15, Cloud - Rolling Hills, PRO-3020)
"Not all of these items on this proposal are showing up in the rooms. Anytime an item is added to a proposal or doc it should automatically be updated in the room board. It also should be updated in Selections so we know what room the item is in."
Identity: **product + room** (same item in two rooms = two clips).

## Grounding (confirmed, index.html — re-read Jul 15)
- `cchPushDocLineRoomsToLinkedClips` @12497 — linkage stamp only; never creates clips / never pushes room.
- `saveDocLineItem` @33347 — calls push @33525; comment @33497 isolation.
- `docEditSave` @37532 — push @37753.
- `_selEnsureClipsForProjectProducts` @16390 — create clip keyed by product+room.
- `_disBuildProjectClipIndex` @18008 + `_disResolveClipIdFromIndex` @18029.

## Phase 1 ONLY
Forward-sync on line-save for proposals/invoices. Dry-run mode reports without writes. Clip identity = product + room. Never overwrite an existing roomed clip. Skip labor/expense/workroom/header. Staging only. **Do NOT build Phase 2 backfill.**

## DONE
`loop/WO-045_DONE_CR_Jul15.md` + `_DEPLOY_QUEUE.md` (staging). Don't mark VERIFIED.
