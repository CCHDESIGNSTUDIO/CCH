# WO-404 DONE — RH freight counted twice

Cindy Nov 5: Rolling Hills miscellaneous freight on INV-6086 was doubled. The Cost → Shipping move left the old price in `rate`, and the invoice total treats rate as product when amount and cost are 0.

## Data (production Firestore, written)

`boards/cloud-rolling-hills/invoices/pftDOyPOdztvpeqn6KBP` (INV-6086, Unsent, no qbDocId)

14 lines (indexes 0, 2, 3, 5, 8, 10, 13, 14, 15, 20, 22, 23, 24, 27):

- `rate` and `unitPrice` set to 0
- `expenseType` set to `freight`, `qbCategory` set to `Freight`
- `shipping` left as the freight dollars ($4,888.20 combined)
- `amount` and `cost` were already 0 and were not changed
- descriptions, notes, taxable, expense lines, and tax ($336.64) were not changed
- stored `total` was not rewritten

Merchandise $5,686.70 + shipping $4,888.20 = $10,574.90, plus the tax already on the invoice.

## Code (not deployed)

`platform/index.html` `invoiceLineAmountForTotals` (~32229): if amount and cost are 0 and shipping is set, the line amount is 0. Shipping is added once in `invoiceTotalsBreakdown`. CCH_BUILD 9.9.481. Needs a production GO before it is live. The data fix is enough on the current live build after a hard refresh.

## Self-test

Re-read the 14 lines: rate 0, unitPrice 0, amount 0, expenseType freight, shipping unchanged. Temp script deleted. Not click-tested in the browser.
