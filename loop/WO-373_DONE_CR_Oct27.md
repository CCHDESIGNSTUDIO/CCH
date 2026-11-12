# WO-373 DONE — Bill items grouped by invoice date

Cindy Oct 27. On Edit vendor bill for PO-9036 every item looked the same. She wants to see what has been invoiced, by date.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoLineInvoiceStampMap`. A line gets a date only when a saved shipment lists that line. Edit vendor bill groups the rows under **Invoiced {date} · {number}**, then **Not invoiced**. `cchPoLineInvoiceHtml` shows the same line on the purchase order page.
- `platform/cch-proposals-invoices-fix.js` — purchase order view only (`type === 'po'`). The date sits under the item name. Proposals, invoices, and the print table are unchanged.
- `platform/index.html` — Studio 9.9.453. Cache `?v=20261027wo373`.

## Self-test

`node --check` passed on both scripts. Not clicked in the browser. Amounts are not written.
