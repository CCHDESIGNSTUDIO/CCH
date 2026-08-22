# WO-059 · Promote build 9.8.108 (WO-045/055/056/058) + Firestore rules to PRODUCTION · CW Jul 23
**Change ID:** pending #1 assign (DEPLOY) · **State:** OPEN — awaiting Cindy GO + Vanessa-timing · **Executor:** Cursor/Cindy · **Verifier:** Claude (Cowork)
Unblocks Cindy's live work: same item in multiple rooms on real proposals.

## Why
The multi-room chain is verified on staging 9.8.108: WO-045 (reverse sync), WO-055 (add same item to multiple rooms), WO-056 (Selections duplicate into a second room), WO-058 (boomerang-safe removal). Production still runs the old build, so Cindy hits the gray-out and cannot build same-item-multiple-room proposals in her live projects. This promotes the code so she can.

## Deploy (two parts, MUST ship together)
1. **Code:** deploy index.html + modules at build 9.8.108 (tag wo058b-fillblank-suppress-rules) to production hosting (cch-design-boards -> cch-platform.web.app).
2. **Firestore security rules:** deploy the PRODUCTION rules update adding `boards/{projectId}/clipSuppressions` read/write for signed-in staff. CRITICAL: without this the WO-058 belt is dead in prod exactly as it was on staging before the fix (permission-denied), and removed Houzz items will boomerang. Do NOT ship the code without the rules.

## Constraints
- **No production deploy during Vanessa's workday** (standing rule). Cindy sets the timing / gives GO.
- This is CODE + RULES only. It does NOT run any data backfill. New multi-room proposals work immediately once live; existing room boards are untouched.

## NOT in this WO (separate, needs explicit Cindy GO)
- The WO-045 backfill apply on production (`cchApplyDocLineClipSync('cloud-rolling-hills')`) that writes historical clips for existing docs. That is a production data WRITE, pilot Rolling Hills first, then roll out. Held until Cindy types GO. Keep it decoupled so the feature ships without touching historical data.

## Verify (Claude, production, after deploy)
1. Prod build tag reads 9.8.108.
2. `clipSuppressions` readable in prod (no permission error).
3. On a prod draft proposal: add the same product twice -> two lines, set different rooms, both persist (WO-055).
4. Remove a roomed Houzz clip whose product is on a roomed doc -> dry-run skippedSuppressed, stays gone (WO-058).
Screenshots to loop/verify/WO-059/.

## DONE note
loop/WO-059_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (production).
