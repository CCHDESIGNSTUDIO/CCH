# WO-381 DONE — PO total is the first amount on the rail

Cindy Oct 27, PO-9015. The totals card led with Not billed. The first amount is the purchase order total.

## Files

- `platform/cch-proposals-invoices-fix.js` — purchase order rail only (`type === 'po'`, ~3883). The Not billed row is gone. Order is PO total, Bills, Paid. Buttons stay under the receiver block.
- `platform/index.html` — Studio 9.9.461. Cache `cch-proposals-invoices-fix.js?v=20261027wo381`.

## Not changed

Bills and Paid math, stored amounts, invoices, proposals, and print were not changed.

## Self-test

`node --check` passed. The page was not click-tested.
