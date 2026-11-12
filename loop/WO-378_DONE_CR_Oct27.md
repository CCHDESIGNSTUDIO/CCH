# WO-378 DONE — Ship invoice row shows that invoice’s total

Cindy Oct 27. INV-000651907, Brock Medium Sconce, still showed $5,806.07 in the vendor invoice table. Merchandise under it was $1,318.80.

## Cause

`cchPoVendorInvoiceGroupTotal` returned the whole stored bill when the bill header invoice number matched the row. The header number is INV-000651907, so Brock’s row showed the combined bill.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoVendorInvoiceGroupTotal` (~5768). A row total is that invoice’s purchase-order lines plus charges on that invoice number. The Due amount uses the same total.
- `platform/index.html` — Studio 9.9.458. Cache `cch-po-bill-variance.js?v=20261027wo378`.

## Not changed

PO-9017 stored bill total was not rewritten. Proposals, invoices, and print were not changed.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The page was not click-tested.
