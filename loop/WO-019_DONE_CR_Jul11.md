# WO-019 DONE · Follow-Ups Houzz excluded ALL lanes · CR Jul 11
**State:** DONE-UNVERIFIED (staging deploy) · **Build:** `20260711fu6`

## Changes
- `platform/cch-followups.js`: added `fuDocIsHouzzSource` aligned with `cchOmIsHouzzSourcePo` (+ IN-11xxx/IN-12xxx fallback)
- `fuDocIsStudioNative` now excludes all Houzz-sourced docs
- Gated **every** detector in both lanes (client-court invoice aging was the gap)
- Exposed `window.cchIsHouzzSourceDoc` for shared use
- `platform/index.html`: cache buster `cch-followups.js?v=20260711fu6`

## Deploy
- **Staging only** (`cch-studio-staging` → cch-platform-staging.web.app)
- Production **not** deployed for this WO

## Verify (Claude)
Follow-Ups on staging: no IN-12xxx Houzz rows in Waiting on Client or Waiting on You; real Studio stalls still show; no `.select` TypeError.
