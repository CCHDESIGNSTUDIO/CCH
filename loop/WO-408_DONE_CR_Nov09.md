# WO-408 DONE — Bill page uses the saved vendor bill

Cindy Nov 9, PO-12920 Cloud Rolling Hills. Edit bill is the correct set: merchandise $37,130, shipping $1,500, trade discount −$6,000, vendor bill $32,630, variance vs full PO −$7,175. The page header showed variance −$23,265 and the sidebar showed Bills $16,540.

## Cause

`cchPoListBillTotalForRow` and the PO rail used the ship-invoice group total. That group only had some of the billed lines, so it came out to $16,540. Variance was that number minus the PO ($39,805), which is −$23,265. The saved bill total was $32,630.

## Change

- `cchPoListBillTotalForRow` and `cchPoPayableBillTotal`: a received bill with `billTotal` is the bill. A ship-invoice sum is used only when there is no saved bill.
- `cchPoVendorInvoiceGroupTotal`: when the invoice number is the saved bill’s invoice, the total is `bill.billTotal`.
- `cchPoVendorInvoiceBalanceDue` and the bill breakdown: a payment with no invoice number counts against that saved bill, so a paid bill does not show a balance due.
- The breakdown lists the bill’s lines, not only the lines checked on the ship-invoice group.
- The totals under the PO lines follow the bill: billed merchandise, the bill’s charges, vendor bill, variance.
- The right rail Bills figure uses that same payable total.
- PO line cost, quantity, and amount are not written. No QuickBooks push.

## Files

- `platform/cch-po-bill-variance.js` — list total ~1657, payable ~1702, group total ~6051, balance due ~6129, breakdown ~4357, footer ~7251
- `platform/cch-proposals-invoices-fix.js` — rail Bills ~3946
- `platform/index.html` — Studio 9.9.485, cache `20261109wo408`
- `platform/client.html` — same cache on the shared script. Client pages do not show POs.

## Self-test

`node --check` on both JS files. Not clicked through in the browser. PO line prices were not rewritten.
