# WO-058 DONE CR — Room-board remove = unassign (Houzz-proof) · Jul 23, 2026

**Build:** v9.8.107 (`wo058-unassign-room-houzz-proof-2026-07-23`)  
**Where:** staging (queue) — prod on Cindy GO  
**File:** `platform/index.html`  
**GATE:** WO-045 production/staging **writes** stay OFF until Claude verifies this on staging.

## Grounding (this session)

| Symbol | file:line (approx) |
|--------|-------------------|
| `cchEnsureClipsFromDocLines` category-as-room → skip + `skippedSuppressed` | ~12690–12782 |
| `_selEnsureClipsForProjectProducts` blank/category skip | ~16986–16998 |
| `cchClipSuppressionKey` / load / write / clear | ~12947–13001 |
| `_clearCatalogRoomForRemovedClip` (Houzz-proof, multi-room-safe) | ~77031–77098 |
| `_cchProductStillOnRoomedDocLine` | ~77101–77126 |
| `removeClipFromRoomBoard` (default unassign + suppress if doc-lined) | ~77128–77176 |
| `deleteClip` (secondary; suppress if doc-lined) | ~77178–77215 |
| Room card / list "Remove" UI (not 🗑 Delete) | ~22253, ~22716 |
| Clip detail: primary Remove from room / secondary Delete permanently | ~76910 |
| Selections create + fill-blank clear suppression | ~39428, ~39504 |

## What changed

1. **Default room-board removal = unassign room** — stays in Selections with `room:''`. UI labels "Remove" / "Remove from room"; Delete is clearly permanent.
2. **Houzz-proof catalog clear** — match libId or title+vendor project-wide; clear only the removed room **or** category-as-room junk; does **not** wipe other legitimate multi-room rooms.
3. **Spawn guards** — blank room or `_cchKnownFfeCategoryLower(room)` never creates a board clip (Selections ensure + doc-line ensure).
4. **Belt:** `boards/{projectId}/clipSuppressions` when product still on a roomed proposal/invoice/PO line; ensure counts `skippedSuppressed`. Re-add / fill-blank / new clip to that room clears suppression.
5. **Decline / Hide untouched.**

## Self-test

- Grep: `Remove from room`, `skippedSuppressed`, `_clearCatalogRoomForRemovedClip`, `cchWriteClipSuppression`.
- `CCH_BUILD` = 9.8.107.
- index.html tail intact (no truncation).

## Verify (Claude, staging) — the honest test

1. Houzz-style clip (dupe rows / no libId / category-in-room possible) on a room board.
2. **Remove from room** → gone from board, still in Selections with no room.
3. Run ensure / (optional) flip `_cchDocLineClipEnsureApply` on staging only → **stays gone**.
4. Category room "Lighting" never spawns.
5. If also on a roomed draft proposal line → dry-run shows `skippedSuppressed`, not `wouldCreate`; re-add clears it.
6. Decline/Hide unchanged.

**State:** DONE-UNVERIFIED  
**Blocks:** WO-045 write enable / Rolling Hills prod apply until verify passes.
