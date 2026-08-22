# WO-058b DONE CR — fill-blank + clipSuppressions rules · Jul 23, 2026

**Build:** v9.8.108 (`wo058b-fillblank-suppress-rules-2026-07-23`)  
**Also deploy:** `firestore.rules` (staging) — `boards/{projectId}/clipSuppressions` read/write for `isAuth()`  
**Prior:** v9.8.107 VERIFY FAIL — see `loop/verify/WO-058/VERIFY_CR_Jul23.md`

## Grounding

| Issue | Evidence |
|-------|----------|
| fill-blank re-rooms | `cchEnsureClipsFromDocLines` ~12806 matched blank clip via `byTVUnroomed` → `filledBlankRoom` |
| suppressions denied | no `match /clipSuppressions` in `firestore.rules` (explicit board subcollections only) |

## What changed

1. **`firestore.rules`** — `clipSuppressions/{docId}` allow read/write if `isAuth()`.
2. **Unassign stamps clip** — `_roomUnassignedFrom` + `_roomUnassignedAt` on the cleared room.
3. **fill-blank** loads the unroomed clip first; if `_roomUnassignedFrom` matches the doc-line room → `skippedSuppressed` (reason `user-cleared-room`), never fill.
4. **Suppression write always** on Remove from room / Delete (not only when still on a doc line).
5. Deliberate Selections fill / doc-line fill clears stamp + `cchClearClipSuppression`.

## Retest (Claude — same candidate)

1. Staging Ctrl+Shift+R → build **9.8.108**.
2. Confirm `boards/cloud-rolling-hills/clipSuppressions` readable (no permission error).
3. Remove clip `rOPcgZOtBfQxocbabgYx` (Kitchen / PRO-3019 Emtek) via Remove from room.
4. Dry-run: that line under **`skippedSuppressed`**, NOT `filledBlankRoom` / wouldCreate.
5. Optional apply: stays off Kitchen board, room still blank in Selections.
6. Re-add via Selections → suppression cleared, can return.

**GATE:** WO-045 writes stay OFF until this retest passes.  
**State:** DONE-UNVERIFIED (rework after VERIFY FAIL)
