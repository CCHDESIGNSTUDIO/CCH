# WO-419 DONE — Bill to client tab; pre-paid tax defaults Absorbed

Cindy Nov 11. The Pending tab should say Bill to client. Absorb and Pre-paid tax are the default on every pre-paid tax line.

## Files

- `platform/cch-po-bill-variance.js`
  - Reason meta ~264–266: tax family disposition default is `absorbed`.
  - `cchPoDeriveVarianceComponents` ~381: empty, undecided, pending, or `prepaid_tax` on a tax reason becomes `absorbed`. A stored Bill to client (`billable`) or Absorbed choice is kept.
  - `cchPoVarianceStatusLabel` ~9704–9714: billable reads Bill to client. A tax line that is absorbed reads Absorbed · Pre-paid tax.
  - `cchPoVarianceFilterChipsHtml` ~9746: the pending chip label is Bill to client.
  - `cchPoBuildVarianceTableRowsHtml` ~9788–9793: freight, discounts, and price changes use Bill to client and Absorbed. A pre-paid tax line on the default does not show those buttons. A tax line already marked Bill to client still shows them.
  - Intro copy ~10325. Alert ~8745. Paint ~9617.
- `platform/index.html` ~5029 Studio 9.9.496 `bill-to-client-tax`. Script ~92353 `cch-po-bill-variance.js?v=20261111wo419`.

## What did not change

Amounts. Stored Pass on / Bill to client and Absorbed choices. Freight, discount, and price-change choices. Print CSS. QuickBooks. Production.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Not clicked in the browser. Staging deploy follows.
