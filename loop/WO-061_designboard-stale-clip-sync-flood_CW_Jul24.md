# WO-061 · Design Board / proposal sync floods console with "No document to update" on deleted clips (feels sticky) · CW Jul 24
**Change ID:** pending #1 assign (DB-PERF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.** Same clip-lifecycle family as WO-045/058. Blocks comfortable Room/Design board building (RH, prod v9.8.111).

## What Cindy hit (prod RH Design Board "Powder Baths")
Console flooded (47 warns) with repeated:
`syncProposalLinkOntoClips cloud-rolling-hills <clipId> No document to update: .../boards/cloud-rolling-hills/clips/<clipId>`
plus `[removeProposalItem] clip unlink <clipId> No document to update`. Board feels sticky.

## Root cause (grounded, index.html)
- `syncProposalLinkOntoClips` (@39092) collects each proposal line's `clipId` and calls `clips/<cid>.update(patch)` for every one (@39140), catching failures with a `console.warn` (@39141). Proposal lines still hold `clipId` pointers to room-board clips that were DELETED, so every id throws "No document to update" and logs. It does not corrupt data, but it is N failed Firestore write round-trips inside `Promise.all` on each proposal edit / approval / board interaction -> latency + console flood.
- `removeProposalItem` clip-unlink (@34357) same class: `clips/<removedClipId>.update(...)` on an already-deleted clip throws and warns.
- Net: stale line->clip pointers (the mirror of the WO-058 boomerang: when a clip is deleted, the proposal line's `clipId` is never cleared).

## Change
1. **Existence-gate the writes.** Before updating, resolve which clipIds actually exist for the project once (reuse `_disBuildProjectClipIndex` @18525 or a single `clips` snapshot) and only `.update()` ids that exist. Skip missing ids silently (no warn). Eliminates the failed writes and the flood, and cuts the round-trips.
2. **Prune the dead pointer (heal forward).** When a line's `clipId` resolves to a missing clip, clear that `clipId` on the proposal line (write back the pruned line array once) so it stops being retried on every future sync. Respect doc-isolation: only clearing a dead pointer, not writing any library field back. Gate behind the existing `cchGuardDocBackSync` path already used here.
3. **removeProposalItem:** guard the clip-unlink the same way (skip if the clip is already gone; do not warn). A missing clip on removal is a no-op success, not an error.
4. **Downgrade residual logging:** any remaining not-found should be a single debug line, never a per-id warn loop.

## Acceptance (binary)
1. Opening the RH "Powder Baths" Design Board and editing/approving a proposal line produces NO "No document to update" warnings; console clean.
2. Board interaction latency visibly improves (no N failed writes per action).
3. A proposal line whose clip was deleted gets its dead `clipId` pruned once, then never retried.
4. Live clips still receive the real link/decision patch (approved/declined still flows; pending never overwrites a room-board decline, per the Jun 7 rule @39138). No data regression.

## Constraints
- Never split index.html. Doc-isolation: no library back-sync; only prune dead clip pointers. Escaped onclick N/A. Financial line array write only removes a broken clipId, nothing else.

## Verify (Claude, staging)
Delete a room-board clip that a proposal line points to, then open the Design Board / edit the proposal: confirm no warn flood, pointer pruned, live clips still patched. Screenshot console to loop/verify/WO-061/.

## DONE note
loop/WO-061_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
