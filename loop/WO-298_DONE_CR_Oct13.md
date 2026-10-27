# WO-298 DONE — Cancelled line on a vendor bill

Cindy Oct 13, PO-9028 Elu (Cloud Rolling Hills). A size she is not ordering has to come off the bill. The purchase order line stays.

## What changed

`platform/cch-po-bill-variance.js`

- `CCH_VENDOR_INVOICE_TYPES` — added Cancelled.
- `cchPoVendorInvoiceSource` — `cancelled` / `canceled` / `cancel` stay Cancelled. They do not fall through to Extra.
- `cchPoRefreshCancelledRow` — checking the item sets Amount to the opposite of that PO line. Amount is locked. Description label becomes Reason.
- `cchPoCancelledChargeError` — save stops if the item is not checked or the reason is blank.
- `cchPoReadVendorInvoiceRowsFromDom` — cancelled amount is the opposite of the checked PO lines.
- Bill preview — that item shows Line total $0. The cancelled row shows the reason and the credit.
- `cchPoChargeItemsFromVendorInvoices` — stored title is `Cancelled: {item} — {reason}`.
- Other $0 charges are still ignored.

`platform/index.html` — Studio 9.9.386, cache `cch-po-bill-variance.js?v=20261013wo298`.

PO lines are not deleted. Proposals, invoices, and print were not changed. QuickBooks is not pushed.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed.

Not on the live site until a production GO. Live is still Studio 9.9.385.

## Verify after deploy

Hard refresh PO-9028, Edit bill. Leave Small and Med checked in section 1. Add a charge, type Cancelled, check Small, write the reason. Amount fills as −$1,250. Preview line total for Small is $0. Repeat for Med (−$1,350). Large stays. Save. The purchase order still lists all three pendants.
