# WO-300 done — pre-paid tax in the PO corner balance

Cindy Oct 15, PO-12915. Pre-paid tax has to be in the corner Bill total and Balance due. Paying the balance without it records the wrong amount.

## Grounding

PO totals rail: `platform/cch-proposals-invoices-fix.js` ~3816. Bill total used `cchPoVendorBillTotal`. Pre-paid tax was a line under Paid, and only when a charge row was detected. `cchPoPrepaidTaxTotal` (`cch-po-bill-variance.js` ~1609) did not read `bill.tax` when charge rows existed. Balance due could fall back to merchandise.

PO view only. Invoices and proposals use a different rail. Print CSS was not changed.

## Change

- Pre-paid tax is a line in the corner, above Bill total.
- Bill total and Balance due use `cchPoPayableBillTotal` / `cchPoAmountDue`. If the stored bill total left `bill.tax` out, that tax is added once. It is not added twice.
- The line-item footer uses the same payable total.
- The note “Sales tax on vendor bill only” stays only when there is no pre-paid tax amount.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoPrepaidTaxTotal`, `cchPoPayableBillTotal`, `cchPoAmountDue`, line footer
- `platform/cch-proposals-invoices-fix.js` — PO totals corner
- `platform/index.html` — cache `cch-proposals-invoices-fix.js?v=20261015wo300`, Studio 9.9.387

## Self-test

`node --check` passed on both JS files. Not checked in the browser. Not deployed.

PO-12915’s open bill in the screenshot had no tax charge saved. The corner stays $3,164.96 until a Pre-paid tax amount is on that bill. After that, the tax is inside Bill total and Balance due.
