# WO-302 DONE — Meeting notes on the portal

**Date:** 2026-10-16
**State:** DONE-UNVERIFIED
**Deploy:** staging hosting + firestore rules ~12:11. Studio 9.9.388. Production not deployed.

## What changed

- `platform/cch-portal-records.js` — Meeting notes page. Date, type (site / call / note), who attended, Discussed, Decisions, Next steps with owner. Save draft or Publish. Staff notes write to `meetingSummaryPrivate` only.
- `platform/index.html` and `platform/client.html` — sidebar item, route slug `meetings`, page mount, script `cch-portal-records.js?v=20261016wo302`.
- `firestore.rules` — `meetingSummaries` (clients read published only; clients may update ack/comments) and `meetingSummaryPrivate` (staff only).

## Not changed

Shared print CSS. Proposal, invoice, PO, and tear-sheet print. Existing Notes page. Money documents.

## Verify

Hard refresh https://cch-platform-staging.web.app. Orange STAGING banner. Studio 9.9.388. Open a project client portal. Meeting notes. Save a draft (client must not see it). Publish. Client can acknowledge.
