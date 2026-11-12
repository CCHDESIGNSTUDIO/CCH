# WO-382 DONE — Ship and delivery show on the vendor invoice row

Cindy Oct 27, PO-9009. The line said Shipped with ETA Jun 18. The vendor invoice Order status and Ship & delivery columns were blank.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoInvoiceRowShipDisplay` (~6544). The invoice row uses its own status and dates first. Blank cells use the purchase-order lines on that invoice, then the purchase-order ship status. The shipping panel uses the same dates. Confirmations are not marked Shipped from the purchase order.
- `platform/index.html` — Studio 9.9.462. Cache `cch-po-bill-variance.js?v=20261027wo382`.

## Not changed

No new status control. Stored ship fields were not rewritten. Proposals, invoices, and print were not changed.

## Self-test

`node --check` passed. The page was not click-tested.
