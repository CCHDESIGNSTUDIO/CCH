# WO-420 DONE — Pre-paid tax is its own tab, not Absorbed

Cindy Nov 11. Pre-paid tax is not Absorbed. The client pays that tax on the invoice. It must not look like the studio is losing the money.

## Files

- `platform/cch-po-bill-variance.js`
  - Reason meta ~264–266: tax family disposition is `prepaid_tax`.
  - `cchPoDeriveVarianceComponents` ~381: a tax line that is not already Bill to client displays as `prepaid_tax`, including one that had been treated as absorbed.
  - `cchPoApplyVarianceRowFilter` ~9576–9593: the Absorbed tab skips tax lines. A purchase order whose only charges are pre-paid tax does not appear there.
  - `cchPoVarianceStatusLabel` ~9710–9717: those lines read Pre-paid tax.
  - Choice buttons ~9788: Bill to client and Absorbed stay on freight, discounts, and price changes. They are not on a pre-paid tax line.
  - Intro copy ~10326.
- `platform/index.html` ~5029 Studio 9.9.497 `prepaid-tax-own-tab`. Script ~92353 `cch-po-bill-variance.js?v=20261111wo420`.

## What did not change

Amounts. The Bill to client tab name. A tax line already marked Bill to client stays Bill to client. Print CSS. QuickBooks. Production.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Not clicked in the browser. Staging deploy follows.
