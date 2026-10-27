# WO-180 DONE — Send: force-refresh Square link when tax changes total
**Executor:** Cursor · **Date:** 2026-09-03 · **State:** DONE-UNVERIFIED

## Root cause (grounded)
`_sendDocToClient` (`index.html:46428–46439`) checked `if (!_hadSq)` — only created Square link
if none existed. When a link already existed (created pre-Send from the rail), Send reused it
even if the tax-inclusive total had just been persisted and the link amount was now stale.

INV-6070 Katke timeline:
1. "Create Square pay link" clicked from rail → link built on `inv.total = $9,098.60` (merch only, no tax)
2. Cloud Function grossed up 3%: `$9,098.60 / 0.97 = $9,380.00` → that's what Square charged
3. Send hit → tax persist wrote `total = $9,518.08` ✓
4. BUT `_hadSq` was truthy → link refresh skipped → stale `$9,380` link sent to Shelley
5. Shelley paid `$9,380`, Studio recorded net `$9,098.60`. Tax `$419.48` not collected.

## Fix — `platform/index.html` ~46428

Changed from "only ensure if no link exists" to "also refresh if existing link was built
on a different due amount":

```javascript
var _sqPriorDueCents = Number(data && data.squareInvoiceDueCents) || 0;
var _sqNewTotalCents = Math.round((parseFloat(data.total) || 0) * 100);
var _sqNeedsRefresh = !_hadSq || (_sqPriorDueCents > 0 && Math.abs(_sqPriorDueCents - _sqNewTotalCents) > 1);
if (_sqNeedsRefresh) {
  var _ensured = await window.cchEnsureSquarePaymentLink(projectId, docId);
```

The Cloud Function (`squarePaymentLink.js:156`) already handles stale-link correctly:
it only reuses if `squareCheckoutAmountCents === charge` — so the refresh call creates
a new link with the correct tax-inclusive amount.

## Cache buster
`9.9.312` → `9.9.313`, tag `square-link-tax-refresh-2026-09-03`

## Surfaces
- Invoice Send only — no other path touched
- Print/PDF not touched

## Verify
1. Create invoice with tax
2. From the rail, click "Create Square pay link" BEFORE Send (creates stale link at merch-only total)
3. Adjust tax or add a taxable line so total changes
4. Hit Send → Square link should be refreshed to the new tax-inclusive total
5. Open Square pay link — amount should match invoice Total including tax
