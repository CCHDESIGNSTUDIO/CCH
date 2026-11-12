# WO-380 DONE — PO rail shows what has not been billed

Cindy Oct 27. Each bill has a total and gets paid. Those add up. The purchase order total stays. The difference is the items that have not been billed, and that amount belongs at the top.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoShipInvoiceMoney` (~5768). PO total is the purchase order. Bills are the ship-invoice totals. Not billed is the purchase-order lines that are not on a ship invoice. Confirmations are not bills.
- `platform/cch-proposals-invoices-fix.js` — purchase order rail only (`type === 'po'`, ~3876). Order is the totals card, then the receiver block, then Edit / Print / Pay bill / Record credit. The open-balance row is gone from this card.
- `platform/index.html` — Studio 9.9.460. Cache `cch-proposals-invoices-fix.js?v=20261027wo380` and `cch-po-bill-variance.js?v=20261027wo380`.

## Not changed

Stored bill amounts, payments, and QuickBooks were not rewritten. Invoices, proposals, and print were not changed.

## Self-test

`node --check` passed on both scripts. The page was not click-tested.
