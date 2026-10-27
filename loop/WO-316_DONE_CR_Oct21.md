# WO-316 DONE — Placed orders are not drafts

Cindy Oct 21. Orders that need you listed PO-9035 Urban Electric as Draft, not sent. The PO page shows Confirmed, order conf # S0102874, bill received, and paid.

## Cause

`pepperPoIsDraft` in `platform/cch-pepper.js` returned true when `cchPoProcurementLaneId` was draft, and also when `status` was draft or blank. The second check won. A confirmed or paid PO whose old status field still says draft was labeled Draft, not sent. The lane already treats an order confirmation number as confirmed without an email (`cchPoProcurementLaneId`, `cch-po-bill-variance.js` ~3671).

## Change

`pepperPoIsDraft` (~2778). A PO is not a draft when it is paid, billed, or past confirmation (`cchOmIsPastConfirmation`). Otherwise it follows the procurement lane only. An order confirmation number, or Confirmed, is not a draft. Email is not required. A PO with no confirmation, no send, and no bill can still appear as Draft, not sent.

`platform/index.html` Studio 9.9.400, tag `orders-not-draft-when-placed`. Cache `cch-pepper.js?v=20261021wo316`.

## Self-test

`node --check` exit 0.

## Verify

Hard refresh. Open Cloud Rolling Hills. Orders that need you. PO-9035 is not in the list as Draft, not sent. A PO with an order conf # is not labeled draft. A PO that was never given a confirmation and was never paid can still be listed.
