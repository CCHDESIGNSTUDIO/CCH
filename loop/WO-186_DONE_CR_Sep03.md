# WO-186 DONE — PO view thumbs show full fixture
**Executor:** Cursor · **Date:** 2026-09-03 · **State:** DONE-UNVERIFIED

## Symptom
Cindy Sep 3 PO-9051 view: lantern/sconce photos cropped or tiny in the 64px squares (`object-fit: cover`).

## Grounding
- `cch-proposals-invoices-fix.js` ~3336: shared doc-view thumb for non-invoice types used `object-fit:cover`.
- Print CSS already uses `contain` (`~5727`, `~5791`). Screen view did not.

## Change
- PO view only: `object-fit:contain; object-position:center` on the 64px thumb.
- Invoice still uses `cchBuildInvoiceLineImgHtml` (cover). Proposal else-branch still cover.

## Surfaces
- PO Client/Manage view line thumbs. Print already contain. Not @page / Bill To.

## Verify
1. Open PO-9051 view (hard refresh). Hex Lantern / tall sconces should show the whole fixture in the square (letterbox OK).
2. Spot-check one proposal view: thumbs still fill/crop as before.
