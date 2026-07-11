# WO-012 DONE · Follow-Ups Studio-only + .select fix · Cursor · Jul 11, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/cch-followups.js` | Build `20260711fu5` — removed Admin-SDK `.select()`; `fuDocIsStudioNative` / `window.cchDocIsStudioNative`; `fuDaysSince` −1 for missing dates; Houzz-excluded detectors |
| `platform/index.html` | Script tag `cch-followups.js?v=20260711fu5` |

## Behavior

1. Follow-Ups no longer crashes browser on `.select()` (web SDK).
2. Stall detectors skip Houzz-native docs.
3. Missing dates no longer show "999 days".

## Verify (Claude, staging)

- Open Follow-Ups; no console errors; stalls load for Studio projects.
- Spot-check no Houzz invoice/proposal stalls.

## Deploy

Staging hosting only.
