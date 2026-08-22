# WO-055 DONE CR — Add-item re-add for multi-room · Jul 23, 2026

**Build:** v9.8.105 (`wo055-wo056-multi-room-clip-ids-2026-07-23`)  
**Where:** staging (queue) — prod on Cindy GO  
**File:** `platform/index.html`

## Grounding (this session)

| Symbol | file:line |
|--------|-----------|
| `_disProposalExcludeKeys` / `_disBuildExcludeKeysFromLines` | ~39595 |
| `_disProposalRowExcluded` | ~39607 |
| `_disCountProductOnCurrentDoc` (new) | ~39617 |
| Project Selections filter (no longer hides excluded) | ~40075 |
| `renderItemCardPS` badge “On doc ×N” | ~40120 |
| `addSidebarProductToDoc` re-add → blank room, no shared clipId | ~40437 |
| Bulk `libraryRailAppendAllRoomBoardClips` | still skips already-on |

## What changed

1. Manual Add-item never grays/blocks products already on the proposal.
2. Informational **On doc ×N** chip (Project Selections + Products tabs).
3. Re-add creates a **new line**; room blank (unless roomPrefill); **no shared clipId** so WO-045 can attach a per-room clip later.
4. Bulk “Pull full room board” unchanged (still skips).

## Self-test

- Grep: no “Already on this proposal” / `alreadyOnDoc` disabled path.
- `CCH_BUILD` = 9.8.105.

## Verify (Claude, staging)

PRO-style proposal: product already on doc → still clickable with badge → click adds 2nd line → set Room → both persist.

**State:** DONE-UNVERIFIED  
**Pairs:** WO-056 (Selections duplicate), WO-045 writes stay gated.
