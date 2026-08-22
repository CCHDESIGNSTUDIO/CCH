# WO-045 VERIFY (Claude, staging) · Jul 23 2026 · build v9.8.106
Ran on cch-platform-staging.web.app as cindy@cchdesign.com.

## Dry-run: cchDryRunDocLineClipSync('cloud-rolling-hills')
85 docs. wouldCreate 119, wouldFillBlank 6, alreadyMatched 45, linkedExisting 113,
skippedNoRoom 16, skippedNonProduct 92, skippedGuard 0, errors 0.  => CLEAN.

## Apply: cchApplyDocLineClipSync('cloud-rolling-hills')  (staging only)
After apply: clips 370 -> 459. Re-run dry-run: wouldCreate 0, alreadyMatched 277,
skippedNoRoom 16, errors 0. Room Boards now populated (Bar 8, Butler Pantry 13,
Dining Room 11, Exterior 9, Entry 8, ... 39 rooms / 412 products). VISUALLY CONFIRMED.

## Verdict: VERIFIED on staging. Reverse-sync creates per-room clips cleanly, 0 errors.

## STILL REQUIRED before prod:
1. PROD apply needs Cindy GO (cchApplyDocLineClipSync on cch-platform.web.app writes prod Firestore). Pilot Rolling Hills, then roll to other projects (~125 have the same latent gap).
2. DURABLE ENABLE: window._cchDocLineClipEnsureApply is SESSION-ONLY. New lines won't auto-create clips after reload until it defaults true in code. Needs a small WO (persist/default-on after validation).
3. 16 lines have NO ROOM -> can't board; surface "needs a room" for Cindy to assign.
4. Confirm PO lines are in scope ("any doc -> room"); confirm client view never shows PO #.
