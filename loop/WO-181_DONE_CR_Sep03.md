# WO-181 DONE — Auth boot: defer PO preload to speed first open
**Executor:** Cursor · **Date:** 2026-09-03 · **State:** DONE-UNVERIFIED

## Symptom
Vanessa reported Studio took a long time to open in the morning.

## Grounding
- `platform/index.html` auth boot path starts firm-wide PO preload immediately in `auth.onAuthStateChanged` via `setTimeout(..., 0)` and calls `loadPOsOnlyFast()` (`index.html` around auth block lines `~5278-5286`).
- `loadPOsOnlyFast()` fans out purchase-order reads across all board IDs (`index.html` around `~72637+`), which can compete with first-render work.

## Change
- In `platform/index.html`, changed the PO preload timer from `0` to `1800ms` at login.
- Added a comment documenting why (protect first paint / startup responsiveness).
- Bumped build tag to `9.9.314` (`auth-boot-defer-po-preload-2026-09-03`).

## Why this is safe
- No behavior removal: PO preload still runs automatically, just slightly delayed.
- No permission/model/data changes.
- No changes to print/PDF surfaces.

## Self-test
- JS syntax check across inline `<script>` blocks: PASS.
- Startup path still calls `loadPOsOnlyFast()` after login (deferred).

## Verify
1. Open Studio with hard refresh (`Ctrl+Shift+R`) and sign in as Vanessa.
2. Confirm Projects/dashboard appears quickly without long blank/loading hold.
3. Wait ~2 seconds and confirm PO badge/PO cache still appears as before.

