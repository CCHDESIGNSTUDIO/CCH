# Session Log — Cursor: Room placement P1

**File:** SESSION_LOG_Cursor_2026-07-30.md  
**Created:** July 30, 2026  
**Author:** Cursor (CR)  

## Overview

Cindy locked **P1** to `Docs/FABLE_DECISION_room-placement-model_CW_Jul29_v1.0.md` (written into repo from her Jul 30 spec). Built staging sync + RH dry-run cleanup report. **No prod clip writes. Durable ensure still OFF.**

## Shipped (staging hosting)

| Piece | Detail |
|-------|--------|
| `cchSyncDocLineRoomToPlacement` | Proposal/invoice room → create/link/fill/clear board tile |
| `cchReleasePlacementIfOrphaned` | Multi-doc guard + manual-placement hold |
| `_disResolveClipIdForProductRoom` | Dedupe identity item+room (no stale clipId) |
| Wire | `updateProposalItemRoom`, remove line, doc-edit room/remove |
| Manual creates | `_manualPlacement: true` on Selections/library place |
| Build | **v9.9.49** |

## RH dry-run (prod read-only)

Script: `_scripts/dryrun-rh-placement-dedupe-PROD_BY_CURSOR_2026-07-30.js`  
Report: `Docs/RH_PLACEMENT_DEDUPE_DRYRUN_BY_CURSOR_2026-07-30.json`

| Metric | Count |
|--------|------:|
| Clips | 581 |
| Roomed | 311 |
| Blank | 270 |
| Exact item+room duplicate groups | 6 |
| Extra tiles in those groups | 6 |
| Orphan-blank junk (heuristic) | 0 |
| Roomed `products` records | 186 |

Note: “81 duplicates” may use a different keying than exact lib/title+vendor+room — report lists the 6 exact pairs for review.

## Verify staging

1. Ctrl+Shift+R → **v9.9.49**
2. Proposal: change line Room → toast + matching Room Board tile (or link existing)
3. Clear Room → tile releases only if last claim + not manual
4. Board **Remove** still stamps suppression (does not resurrect on ensure)
5. Durable ensure remains OFF until Cindy proves sync + asks to flip

## Incident — PRO-3017 mirror wipe (staging)

**Symptom:** Cindy changed Floral Charm room on PRO-3017 → Rami Mirror line disappeared.

**Grounding:** `cchSyncDocLineRoomToPlacement` → `cchEnsureClipsFromDocLines([line], { persistLineLinks: true })` wrote `items: [one line]` over the full proposal (`index.html` ensure persist ~13045; sync call ~13379). Staging doc `vZ4zDr6atCV4GBKeaLcq` now `itemsLen=1`; `total` still 1757.7 (= 1336.5 + 421.2); tags still “Wallpaper & Mirror”; activityLog had Line 1+2 approved; linked INV-6026 has Rami Mirror.

**Fix (code, v9.9.50):** `persistLineLinks: false` on one-line ensure; refuse subset persist if shorter than existing; always re-write full in-memory `items[]` after room sync.

**Restore (staging, needs Cindy GO):** dry-run ready — `_scripts/_tmp_restore_pro3017_mirror_staging_BY_CURSOR.js` adds Rami Mirror @ 421.2 Master Bathroom. Not applied yet.

## Room Boards — show all project rooms (v9.9.51)

Cindy: empty rooms must still appear. `renderBoardsTab` now seeds shells from Edit Project `rooms` / `projectRoomList` (not default suggestions). `_pruneEmptyProjectRoom` no longer deletes listed rooms when empty. Explicit Delete Room unchanged.

## Still gated

- Staging deploy **v9.9.51** (includes 9.9.50 wipe fix) + PRO-3017 restore (needs Cindy GO)
- Production hosting
- RH apply/dedupe writes (needs typed GO after dry-run review)
- Durable `_cchDocLineClipEnsureApply` default-on
