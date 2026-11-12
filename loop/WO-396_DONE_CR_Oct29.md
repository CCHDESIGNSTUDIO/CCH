# WO-396 DONE — variance lines are Freight or Expense

Cindy, Oct 29, on INV-6086. A freight line said only Freight. Another line used the sales-order number as the name. The charges were still stored as products.

## Files

- `platform/cch-po-bill-variance.js`
  - `cchPoVarianceClientBucket` — client line is Freight or Expense
  - `cchPoTitleIsInvoiceNumber` — `#S031527` and `#U259GX735X` are invoice numbers
  - `cchPoCleanProductTitle` — those numbers are not product titles
  - `cchPoCleanClientInvoiceLines` — unsent variance title, description, category, and expenseType
  - `cchPoReshapeDraftVarianceInvoiceLines` — same, before the early skip. Note adds `For: {product}`
  - New variance lines no longer store `expenseType: 'product'`
- `platform/index.html` — Studio 9.9.476, script `cch-po-bill-variance.js?v=20261029wo396`

## What changed

Unsent `po_bill_variance` lines: title and description are Freight or Expense. Category matches. `expenseType` is `freight` or `expense`. The product they are assigned to stays on the line and is written into the note as `For: …`. Vendor invoice numbers stay in the note. Amounts and the taxable flag are not changed. Handling & Packing Fee lines are not variance lines and are left alone.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Live before deploy was 9.9.475. Click-test not done.

## Not done

Do not mark VERIFIED. No commit. No Cloud Functions deploy.
