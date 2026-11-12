# WO-377 DONE — PO action buttons back at the top of the rail

Cindy Oct 27. Edit PO, Print / PDF, Pay bill, and Record credit were under the applied payments.

## Files

- `platform/cch-proposals-invoices-fix.js` — `poRailHTML` inside `type === 'po'` (~3876). The button card is the first block in the purchase order rail. Location, receiver check-in, totals, and payments stay below it. Invoices, proposals, and tear sheets were not changed.
- `platform/index.html` — Studio 9.9.457. Cache `cch-proposals-invoices-fix.js?v=20261027wo377`.

## Self-test

`node --check platform/cch-proposals-invoices-fix.js` passed. The page was not click-tested.
