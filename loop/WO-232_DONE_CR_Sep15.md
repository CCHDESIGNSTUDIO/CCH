# WO-232 DONE — Vendor bills list: Inv date + Received

**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED  
**Studio:** 9.9.350

Cindy: dates missing on the vendor/bill report.

## Surfaces

Vendor bills list only (`#/vendorbills` and Order Management → Vendor bills). Same `cchPoBuildVendorBillsPanelHtml`. Not print, not variances.

## Change

`cchPoCollectVendorBillRows` / `rowForInvoice` (`cch-po-bill-variance.js` ~7865, ~8090, ~7955–8028):

- New **Inv date** column = `vendorInvoiceDate` (Document date on Receive bill), per vendor-invoice group when the row is split.
- **Received** now uses `receivedDate` (shipment received on the form), then falls back to `receivedAt`.

Cache buster `cch-po-bill-variance.js?v=20260915po232`. `CCH_BUILD` 9.9.350.

## Self-test

`node --check platform/cch-po-bill-variance.js`. Table: 14 columns; footer colspan 8 + 3 money + 3 trailing.

## Verify

Staging `#/vendorbills` or `#/ordermanagement/bills`. Hard refresh. Inv date next to Vendor inv #. Received shows the date typed on the bill when present.
