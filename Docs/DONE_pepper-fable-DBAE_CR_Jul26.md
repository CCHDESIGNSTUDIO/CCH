# DONE — Pepper Fable D+B+A+E · Cursor Jul 26

**Authority:** `Docs/FABLE_DECISION_pepper-features_CW_Jul26_v1.1.md`  
**Build:** v9.9.3 · `cch-pepper.js?v=20260726c`

## Files touched

| File | Change |
|------|--------|
| `platform/cch-pepper.js` | Digests (decisions, FU, activity, unbilled); presets; `cchPepperVendorFollowUp`; bug path |
| `platform/cch-followups.js` | `_cchFuPepperDigest` (fu8; already present) |
| `platform/cch-order-management.js` | om37: Follow up on openPosTable + missingEtaReport |
| `platform/cch-po-vendor-comms.js` | Follow up next to Send to vendor; `cchPoAppendVendorComm` |
| `platform/cch-bugs-requests.js` | fb6: `window.cchFbQuickSubmit` |
| `Functions/cchPepper.js` | Presets `unbilled_time`, `vendor_status_followup`; digest prompt |
| `platform/index.html` | CCH_BUILD 9.9.3; cache busters; `window._isBillableEntry` |

## Self-test

- `node --check` on all touched JS — OK  
- Feature F / C not implemented (correct)

## Deploy

Queued staging: functions:cchPepper then hosting. Not committed (policy).
