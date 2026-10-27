# WO-352 DONE — variance invoice line

State: DONE-UNVERIFIED. Staging with WO-353 in Studio 9.9.435. Production waiting on GO.

## What changed

A bill-variance line on a client invoice uses the vendor as the title. The item is named once: Freight / shipping expense, or Expense — and the reason. The description is the variance detail only. She edits that description on Manage. Tax this line is her checkbox. New lines start untaxed. Pre-paid tax is still not a client line.

Opening a draft invoice that is not in QuickBooks rewrites lines that still start with “PO …”. Amount, quantity, and cost stay. Sent and QuickBooks invoices are left alone.

Print hides the editor and the tax checkbox and prints the item name and description.

## Files

- `platform/cch-po-bill-variance.js` — line writer; `cchPoReshapeDraftVarianceInvoiceLines`
- `platform/cch-proposals-invoices-fix.js` — Manage editor on `source === 'po_bill_variance'`
- `platform/index.html` — `cchInvoiceLineIsTaxable` returns her flag for those lines; save description and tax; reshape on invoice open. Studio 9.9.435.

## Self-test

`node --check` on the two JS files exited 0. `index.html` ends with `</html>`. Not clicked through in the browser.
