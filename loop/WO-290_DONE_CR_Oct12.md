# WO-290 DONE — PO view shows pre-paid tax under Paid

Cindy Oct 12. PO-9054 (Cloud Rolling Hills, Walker Zanger) totals rail shows Paid and Bill balance. Pre-paid tax on the vendor bill was not listed.

## Grounding

- PO totals rail: `platform/cch-proposals-invoices-fix.js` ~3829–3846. Rows were Merchandise, Shipping, Variance, Bill total, Paid, Bill balance. Caption under that: “Sales tax on vendor bill only.” No amount.
- Vendor bill tax: `cchPoBillVendorInvoicesFromBill` (`platform/cch-po-bill-variance.js` ~2145) merges vendor-invoice rows and legacy `bill.tax` as type `tax`, label “Pre-paid tax.”
- Print/PDF totals (`cch-proposals-invoices-fix.js` ~5513) still skip pre-paid tax when `type === 'po'`. This change does not touch print, Bill To, Ship To, or the line-item block.

## Change

- `cchPoPrepaidTaxTotal` (`cch-po-bill-variance.js` ~1598–1611) sums vendor-bill charges whose type is tax or whose description is pre-paid tax. If that sum is zero, it uses a pre-paid sales-tax line on the PO.
- The PO view rail inserts **Pre-paid tax** directly under **Paid** (or above Balance due when nothing has been paid) when the amount is not zero.
- Studio 9.9.378. Cache `20261012wo290` on `cch-proposals-invoices-fix.js` and `cch-po-bill-variance.js`.

## Self-test

`node --check` passed on both JS files. `index.html` ends with `</html>`. Not opened on production — the live page is still 9.9.377 until a production GO.

## Not changed

Invoice and proposal rails. Print/PDF. Bill total, Paid, and Bill balance math. QuickBooks.
