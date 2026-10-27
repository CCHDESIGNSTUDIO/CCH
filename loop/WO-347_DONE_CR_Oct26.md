# WO-347 DONE — Totals card amounts are larger

Cindy Oct 26. The dollar amounts in the top-right Totals card were hard to read. She asked to make them a bit bigger.

## Change

`platform/cch-proposals-invoices-fix.js` lines 560–564 and 595.

- Amounts (merchandise, tax, shipping, discount, paid): 11px to 14px.
- Total and Balance: 16px, including the number, which was still 11px because the amount had its own size.
- Applied payment amounts: 11px to 13px.

Color and font are unchanged. Print and PDF use a different block and were not touched. The same card style is used on invoices, proposals, and purchase orders, so those amounts are the same size.

`platform/index.html` Studio 9.9.430, tag `rail-totals-size`. Script `cch-proposals-invoices-fix.js?v=20261026wo347`.

## Self-test

`node --check platform/cch-proposals-invoices-fix.js` passed. File tails intact. Did not open the invoice in a browser before staging deploy.
