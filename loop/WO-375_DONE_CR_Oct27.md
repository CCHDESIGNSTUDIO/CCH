# WO-375 DONE — Add vendor invoice reads the recorded bills

Cindy Oct 27. Add vendor invoice on PO-9017 showed confirmation SO-000000515584 and three purchase-order line prices totaling $4,487.27. That is the stored bill header and `billedPoLineIds`, not vendor invoice lines. `bill.vendorInvoices` is empty. The invoice numbers are on the payments.

## Files

- `platform/cch-po-bill-variance.js`
  - `cchPoRecordedVendorBills` (~2432). Bill `vendorInvoices` first. If that list is empty, the payment `vendorInvoiceNumber` and amount.
  - Add vendor invoice no longer copies the confirmation number into the invoice number field (~2792, ~7093).
  - When those recorded bills exist, the item rows are not pre-checked, and the preview lists the bills (~7117, ~7132, ~7409).
  - Saving with nothing new selected does not rewrite the bill. Saving a new line still keeps the previously stored line ids.
- `platform/index.html`
  - `invoiceDocPaymentSummary` (~32510) copies `vendorInvoiceNumber` onto the payment row, so the purchase order card shows the invoice number.
  - Studio 9.9.455. Cache `cch-po-bill-variance.js?v=20261027wo375`.

## Not changed

PO-9017 amounts, payments, QuickBooks ids, and the stored bill total were not rewritten. Proposals, invoices, and print were not changed.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The modal was not click-tested.
