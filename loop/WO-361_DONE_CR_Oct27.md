# WO-361 DONE — variance invoice line names

Cindy Oct 27. INV-6086 titles still read “PO PO-9063 — Price increase”. Do not delete the invoice.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoReshapeDraftVarianceInvoiceLines` (~8269).
  - Draft invoices with no QuickBooks id only.
  - A line titled “PO PO-#### — …” is renamed to the product in the description, or the vendor on the PO.
  - “Price increase” becomes the Price/quantity change label.
  - Amounts, qty, and tax flags are not changed.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The production invoice does not change until she opens that draft on a build that includes this file. Production was not deployed.
