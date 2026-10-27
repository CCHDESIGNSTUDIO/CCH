# WO-191 DONE — Bugs board duplicate-submit guard

**Change ID:** 9.9.322  
**Date:** 2026-09-05  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging queue)

Vanessa Aug 11: six identical `feedbackRequests` rows in twelve seconds (19:53:56–19:54:07) because Send gave no feedback. Same failure mode as the Katke duplicate-invoice bug she was reporting.

## Diagnosis (file:line)

- `platform/cch-bugs-requests.js` `fbQuickSubmit` ~721: `collection.add` with no in-flight lock; composer Send ~686 fired immediately.
- `platform/index.html` `saveFeedbackRequest` ~72065: modal Submit had the same gap.
- No native `alert()`. Toast + button label only.

## Surfaces

| Intended | Must not |
|----------|----------|
| Studio Bugs & Requests quick-send + full modal **new** submit | Client portal (module not loaded there) |
| Immediate "Sending…" + ignore further clicks | Change thread/reply send |
| 60s fingerprint of type+title+body | Deduplicate distinct reports |

## Change

- `cch-bugs-requests.js`: `cchFbGuardNewSubmit` / `cchFbReleaseNewSubmit`; Send disables to Sending…; duplicate toast "Already submitted — check Bugs & Requests". Build `20260905fb191`.
- `index.html`: `id="fbSaveBtn"`; busy lock before write; same guard on new (not Update) submits. `CCH_BUILD` **9.9.322**. Cache buster `cch-bugs-requests.js?v=20260905fb191`.

## Self-test

- `node --check platform\cch-bugs-requests.js`
- File tail of `cch-bugs-requests.js` intact (`})();`).

## Verify after staging

https://cch-platform-staging.web.app → Bugs & Requests. Ctrl+Shift+R. Sidebar **9.9.322**. Mash Send on a test report: one row, button reads Sending…, second click ignored. Full modal Submit same. Then delete the test row.
