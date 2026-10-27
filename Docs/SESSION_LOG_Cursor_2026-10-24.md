# Session log — Cursor — 2026-10-24

## Overview

Vendor bill bottom stayed $38,887.11. Cindy GO. WO-335 published to production with WO-333 and WO-334.

## What changed

- `platform/cch-po-bill-variance.js` — vendor bill total is the invoice line totals plus freight, tax, extra, and override. Changing unit, qty, the line total, or the amount changes the bottom by that amount. Override is one amount and a note.
- `platform/index.html` — Studio 9.9.420, tag `bill-total-adds-lines`. Cache `cch-po-bill-variance.js?v=20261023wo335`.

## Deployed

PRODUCTION hosting 2026-10-24 ~10:12. https://cch-platform.web.app Studio 9.9.420. Live index matched 9.9.417 except the build tag and that script tag. Functions not deployed. No commit.

The $19.99 gap is the Vintage pair: the form was adding $9,264.22. The vendor pair is $9,284.21. With freight $7,717.00 and tax $2,243.37 the vendor invoice is $38,907.10.

WO-336. PO-9047 Totals card stayed $38,887.11 while the receive-bill form changed. That card was the saved bill. PRODUCTION hosting ~11:32. Studio 9.9.421, tag `bill-total-on-rail`. Cache `cch-proposals-invoices-fix.js?v=20261024wo336` and `cch-po-bill-variance.js?v=20261024wo336`. The Totals card follows the open form. Variance is under Bill total. Functions not deployed. No commit.

WO-337. Vendor credit. Pay bill had no credit method. Record credit on the PO that was overtaxed. Pay bill, method Vendor credit, selects that credit and records the payment. An open credit lowers the PO it sits on. Applying it moves the reduction to the bill being paid. PRODUCTION hosting ~11:52. Studio 9.9.422, tag `vendor-credit-apply`. Cache `cch-proposals-invoices-fix.js?v=20261024wo337` and `cch-po-bill-variance.js?v=20261024wo337`. Functions not deployed. No commit. Studio payments are still not sent to QuickBooks.

WO-338. Open credits on the project Money panel and under Finance. Dropdown of recorded vendor credits and retainer credits. Choosing a vendor credit while another PO is open starts Pay bill with that credit. PRODUCTION hosting ~12:36. Studio 9.9.423, tag `open-credits-nav`. Cache `cch-project-subpanel.js?v=20261024wo338` and `cch-po-bill-variance.js?v=20261024wo338`. Functions not deployed. No commit.

WO-339. Pay bill amount was the bill plus a PO line that is not on the bill. PO-9047 offered $43,069.99. The bill is $38,907.10. Paid $280.11. Amount due $38,626.99. PRODUCTION hosting ~12:58. Studio 9.9.424, tag `pay-bill-amount-is-bill`. Cache `cch-po-bill-variance.js?v=20261024wo339`. Functions not deployed. No commit.

WO-340. PO-9060. Typing an invoice line total was replaced on each keystroke by unit price × qty. The typed total now stays. Shipped with WO-341. Studio 9.9.426.

WO-341. Bill variances. Prepaid tax stays absorbed. Every other line has Pass on or Bury. Cindy GO. PRODUCTION hosting ~14:37. Studio 9.9.426, tag `variance-you-decide`. Cache `cch-po-bill-variance.js?v=20261024wo341`.

WO-342. Design Services invoice line T&E VH displays as T&E. The time ledger already used T&E. The client invoice title did not. PRODUCTION hosting ~14:37 with Studio 9.9.426. Cache `cch-invoice-redesign.js?v=20261024wo342` and `cch-proposals-invoices-fix.js?v=20261024wo342`. Functions not deployed. No commit.

WO-343. Bill Variances badge. Count is component rows not on a client invoice and not buried. Prepaid tax stays out of the count. Studio 9.9.427. Staging hosting ~14:46. Production waiting on GO.

WO-344. Time invoices are one line per entry. Draft INV-6085 splits on open when the new total matches the grouped total. Sent and paid invoices are not rewritten. Studio 9.9.427. Staging hosting ~14:46. Production waiting on GO. INV-6085 is a production invoice.

WO-345. Client credit. A payment can be lowered and the difference held as a client credit, then applied on another invoice with method Client credit. The QuickBooks save warning is drawn above the payment window. Studio 9.9.428. Cindy GO. PRODUCTION hosting ~15:50. Live was 9.9.426. Also ships WO-343 and WO-344. Functions not deployed. No commit. Not sent to QuickBooks.

WO-346. Paid column. INV-6057 showed $9,527.93 because the $4,941.68 receipt and the $4,586.25 applied to that invoice were both added. Same QuickBooks payment now counts once. Studio 9.9.429. Cindy GO. PRODUCTION hosting ~16:20. Live was 9.9.428. Live confirmed 9.9.429. Functions not deployed. No commit.

## Not deployed

Functions. No commit. Square fee formula was not changed. No QuickBooks payment push.

## Verify

Hard refresh https://cch-platform.web.app. Sidebar shows v9.9.420. Reopen Receive vendor bill. The bottom follows the invoice line total.
