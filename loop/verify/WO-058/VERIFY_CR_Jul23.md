# WO-058 VERIFY — FAILED (rework required) · staging v9.8.107 · CW Jul 23

**Verifier:** Claude (Cowork) via staging console, logged in cindy@cchdesign.com, build tag wo058-unassign-room-houzz-proof-2026-07-23.
**Project:** cloud-rolling-hills. **Verdict: FAIL. Do NOT mark VERIFIED. WO-045 production apply stays BLOCKED.**

## Honest test run
Candidate: Houzz-style clip `rOPcgZOtBfQxocbabgYx` = "Modern Cabinet Hardware... Emtek Flush Pull", vendor MyKnobs, NO libraryProductId, room Kitchen. It is matched to a roomed proposal line: PRO-3019 line 0, room Kitchen. This is the exact boomerang case (product on a roomed doc line).

Steps: baseline dry-run -> ran the SHIPPED "Remove from room" (cchConfirm dialog, clicked "Remove from room") -> re-ran dry-run -> inspected PRO-3019 disposition -> restored staging.

## What PASSED
- Primary UX is correct: "Remove from room" un-assigns (clip.room -> ''), the clip is NOT deleted, it stays in Selections. Dialog copy matches spec: "The item stays in Selections with no room assigned. Use Delete only to remove permanently."
- Dry-run now reports the new `skippedSuppressed` counter.

## What FAILED (two independent breaks)
1. **fill-blank-room re-rooms the un-assigned clip.** After un-assign, the clip still exists with room ''. The doc-line sync matches it to the PRO-3019 Kitchen line by title+vendor (byTVUnroomed) and classifies the pair as **fill-blank-room** (action "fill-blank-room", room "Kitchen"). Apply would stamp "Kitchen" back onto the clip -> it returns to the Kitchen board. This is the boomerang in a new disguise: un-assign, then the sync refills the room. Evidence: PRO-3019 detail bucket `filledBlankRoom` = {lineIndex:0, room:"Kitchen", clipId:"rOPcgZOtBfQxocbabgYx", action:"fill-blank-room"}; project wouldFillBlank went 6 -> 7 after removal.
2. **The suppression belt is inert: Firestore rules deny `clipSuppressions`.** Reading `boards/cloud-rolling-hills/clipSuppressions` returns "Missing or insufficient permissions." So `cchWriteClipSuppression` cannot write and `cchEnsureClipsFromDocLines` cannot read it. `skippedSuppressed` stayed 0 through the whole test. The belt never engaged. Security rules were not updated for the new subcollection.

Net: skippedSuppressed=0, and the removed pair surfaced as fill-blank-room (would re-room), NOT as skippedSuppressed. Cindy's real workflow (remove a Houzz item that sits on a roomed proposal) would still boomerang.

## Required rework (Cursor)
A. **Ship Firestore security rules for `boards/{projectId}/clipSuppressions`** (read+write for the same authenticated staff who can write clips). Without this the belt is dead. Verify by reading the subcollection from the console without a permissions error.
B. **The fill-blank-room branch must respect suppression.** A clip whose room the user deliberately cleared must NOT be re-roomed by fill-blank. Options: (i) fill-blank consults `clipSuppressions` for (product, room) and skips -> count skippedSuppressed; and/or (ii) un-assign writes the suppression BEFORE the sync can refill, and fill-blank/byTVUnroomed matching honors it.
C. **Consider:** an un-assigned clip that is title+vendor-matched to a roomed doc line is inherently ambiguous. Decide the rule: user-cleared room wins over the doc line until a deliberate re-add. That is the whole point of WO-058.

## Retest gate (after rework, staging)
Remove clip rOPcgZOtBfQxocbabgYx (Kitchen, on PRO-3019) -> dry-run must show it under `skippedSuppressed`, NOT filledBlankRoom or wouldCreate -> apply -> clip stays roomless and off the Kitchen board -> re-add via Selections clears suppression and it returns. Also confirm clipSuppressions is readable from console (rules fixed).

## Staging state
Restored: clip rOPcgZOtBfQxocbabgYx room set back to "Kitchen"; dry-run totals back to baseline (alreadyMatched 277, wouldFillBlank 6, skippedSuppressed 0, errors 0). No net change left on staging.
