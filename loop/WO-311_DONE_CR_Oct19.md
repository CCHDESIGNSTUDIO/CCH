# WO-311 DONE — Partial vendor payment stays open

Cindy Oct 19. PO-9058 Exquisite Surfaces. She could not enter a partial payment. The pay box closed, and the ship invoice asked for the whole bill.

## What the PO actually has

Production `boards/cloud-rolling-hills/purchaseOrders/jxiinWImJJPl5V9HkYSJ`.

- Bill total $5,160.27. Merchandise $2,880. Price change $864. Pre-paid tax $387.54. Stain proof $230.73. Freight $798.
- One payment: $4,362.27 on 2026-09-29, ACH/Wire, tagged to order confirmation **8004970**.
- Ship invoice **8004985** has the charges, including the freight.
- Stored `paymentStatus` is `paid` and `balance` is 0. That was true before the freight was on the bill. The leftover is $798.

The saved payment was not rewritten.

## Cause

The pay screen treated the confirmation payment as belonging only to 8004970. That invoice then looked paid. The ship invoice still showed $5,160.27 due, because the same two lines were on both paperwork numbers. The amount box filled with $5,160.27. Clicking the dimmed area behind the box closed it. Enter in the amount box could close it too. Open POs hid the PO because `paymentStatus` said paid.

## Change

`platform/cch-po-bill-variance.js`

- `cchPoIsOpen` ~676. A received bill with money still due stays on Open POs.
- `cchPoConfirmationPaymentCredit` ~5264. A payment on an order confirmation counts toward the ship invoice for the same lines. One confirmation payment applies to one ship invoice.
- `cchPoVendorInvoiceBalanceDue` uses that credit.
- Bill breakdown ~3576 and the vendor-bills list ~8391 show the credit as already paid.
- Pay modal ~7045. No close when the dimmed area is clicked. X and Cancel still close it. A typed amount is kept. Enter does not close the box. The amount can be less than the balance.

`platform/index.html` — Studio 9.9.395, tag `po-partial-pay`. Script cache `cch-po-bill-variance.js?v=20261019wo311`.

## Self-test

`node --check platform/cch-po-bill-variance.js` exit 0.

Not deployed. Production is still 9.9.390. This working copy also contains the staging portal work (chat beside Pepper, meeting-notes count, checklist room dropdown, Invoices above Proposals). A production hosting deploy ships that too.

## Verify after GO

Hard refresh https://cch-platform.web.app. Open Cloud Rolling Hills PO-9058. Pay bill. Ship invoice 8004985 should show about $798 due, not $5,160.27. Type a smaller amount if this payment is only part of that. The box stays open until X, Cancel, or Record payment. Studio only. Not sent to QuickBooks.
