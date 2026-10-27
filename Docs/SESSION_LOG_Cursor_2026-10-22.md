# Session log — Cursor — 2026-10-22

## Overview

Meeting notes. A saved draft could not be opened or published. WO-317.

## What changed

- `platform/cch-portal-records.js` — staff Edit, Publish, and Delete on each meeting note. Edit loads the note into the form. Publish sets status published. Delete removes the note and the staff-only text.
- `platform/index.html`, `platform/client.html` — Studio 9.9.401, tag `meeting-note-edit`. Cache `cch-portal-records.js?v=20261022wo317`.

## Deployed

Staging hosting 2026-10-22 ~14:50. https://cch-platform-staging.web.app Studio 9.9.401. This staging copy also includes WO-316 (placed orders are not drafts), which is not on production.

## Not deployed

Production is still Studio 9.9.399. Functions not deployed. No commit.

## Later the same day

WO-319. Edit did not open the note. Each note now has a subject. Clicking the subject or Edit opens the editor on that note. WO-318 is in the same file: setting a task to Done stays on the page in the address bar instead of opening Purchase Orders.

Staging hosting Studio 9.9.403, tag `meeting-note-open`, cache `cch-portal-records.js?v=20261022wo319`.

## Production

Cindy GO 2026-10-22 ~15:10. https://cch-platform.web.app Studio 9.9.403, tag `meeting-note-open`, cache `cch-portal-records.js?v=20261022wo319`. Edit, Publish, and subject. Same hosting includes WO-318 (closing a task stays on the page).

Cindy 2026-10-22: bug fixes go to production. WO-316 production hosting ~15:20. Studio 9.9.404, tag `orders-not-draft`, cache `cch-pepper.js?v=20261021wo316`. A confirmed, paid, or order-confirmation PO is not “Draft, not sent”.

WO-320 production hosting ~15:30. Studio 9.9.405, tag `library-loads`. Add item on PRO-3050 was stuck on Loading library. Functions not deployed. No commit.

WO-321 production hosting ~16:05. Studio 9.9.406, tag `furnishing-note`. Internal notes that mention shipping no longer block adding a furnishing.

WO-322 staging hosting, Firestore rules, and Storage rules ~16:10. Studio 9.9.407, tag `chat-photo`. Client chat Photo button. Production chat and production rules were not deployed.

## Verify

Hard refresh staging. Cloud Rolling Hills, Meeting notes. Oct 7 draft has Edit, Publish, and Delete.
