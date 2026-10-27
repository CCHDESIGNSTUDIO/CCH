# WO-333 DONE — Vendor bill subtotal adds invoice line totals

Cindy Oct 23. The merchandise subtotal on Receive vendor bill added the purchase-order prices. Changing an invoice line total did not move that subtotal.

## Files

- `platform/cch-po-bill-variance.js`
  - `cchPoInvoiceLineAmount` / `cchPoChargeIsFoldedIntoLine` added before `cchPoUpdateBillPreview` (~6611).
  - Preview merchandise rows and Merchandise subtotal use the invoice line total (PO amount plus a price, quantity, or cancel charge that names only that line). Those charges are not added again under the subtotal. Freight, tax, and other fees still add. Vendor bill total is unchanged in amount.
  - Saved bill breakdown `cchPoBillBreakdownTableHtml` (~3622) uses the same line amounts and subtotal.
  - The top picker label is "PO lines selected" so it is not a second merchandise subtotal.
- `platform/index.html` — Studio 9.9.418, `cch-po-bill-variance.js?v=20261023wo333`.

## Self-test

`node --check platform/cch-po-bill-variance.js` exited 0.

## Not deployed

Production only, after Cindy's GO. She is on the live bill. This screen will not change until that deploy.
