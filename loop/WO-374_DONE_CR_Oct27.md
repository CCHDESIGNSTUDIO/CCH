# WO-374 DONE — Purchase order totals are bill, paid, and open

Cindy Oct 27. The purchase order totals card showed merchandise, shipping, variance, and Paid with a minus in front. She wants the bill, what was paid, and the open balance.

## Files

- `platform/cch-proposals-invoices-fix.js` — the purchase order totals card (`type === 'po'`) is Bill, Paid, Open balance. Paid is the payment total, shown as money paid. Open balance is what is still owed, and it does not go below zero.
- `platform/cch-po-bill-variance.js` — while Receive bill is open, the open balance on that card stays at zero when payments already cover the bill.
- `platform/index.html` — Studio 9.9.454. Cache `cch-proposals-invoices-fix.js?v=20261027wo374`.

## Self-test

`node --check` passed on both scripts. Not clicked in the browser. No payment or bill amounts were rewritten. Proposals and invoices were not changed.
