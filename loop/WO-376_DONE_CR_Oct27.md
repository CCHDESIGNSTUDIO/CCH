# WO-376 DONE — One vendor invoice shows its own total

Cindy Oct 27. Edit vendor invoice for Brock Medium Sconce, INV-000651907, showed a combined total of $5,806.07. That invoice is the Brock line, $1,318.80. $5,806.07 was the old stored bill ($4,487.27) plus this line.

## Files

- `platform/cch-po-bill-variance.js`
  - `cchPoUpdateVigBillPreview` (~5586). The total on this screen is this invoice only.
  - `cchPoSaveVendorInvoiceGroup` (~6825). Save keeps the stored bill total and does not write the combined figure or a new variance.
- `platform/index.html` — Studio 9.9.456. Cache `cch-po-bill-variance.js?v=20261027wo376`.

## Not changed

PO-9017 amounts, payments, and the stored bill total were not rewritten.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The modal was not click-tested.
