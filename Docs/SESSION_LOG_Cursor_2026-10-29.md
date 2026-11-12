# Session log — Cursor — 2026-10-29

## WO-398

Edit INV-6086 shows freight dollars in Cost and an empty Shipping column. The variance-to-invoice builder now writes freight, shipping, and expedited charges to Shipping, with cost 0, amount 0, and category Freight. QuickBooks maps category Freight to Studio Freight/Shipping (C2), not product. Expense variances are unchanged. INV-6086 was not rewritten. Studio 9.9.478 is on staging only. Production is still 9.9.477. No commit. No Cloud Functions deploy.

## WO-397

INV-6086. Description boxes had been rewritten to the word Freight or Expense when the invoice opened. That writer is off. The stored notes were copied back into the description field only. Amounts, titles, tax, and categories were not changed. The $800 Concretti line says Concretti Sinks. The $95.95 Arteriors freight and the $442.55 Artistic Tile freight had no stored note, so those boxes still say Freight. Studio 9.9.477. Production hosting 2026-10-29 14:53. The purchase-order variance rebuild was not written. No commit. No Cloud Functions deploy.

## WO-396

INV-6086. Variance charges were still named like products (Freight with no product, EDMUND MIRROR, #S031527, ZEP 19) and stored as products. Unsent variance lines are Freight or Expense. The note keeps the vendor invoice number and adds which product the charge is for. Amounts and the taxable checkbox stay. Handling fees are not touched. Studio 9.9.476.

## WO-395

INV-6086. Freight notes were showing in the Tag column because a short note was treated as a tag. Stored tags were already empty. Invoice screens now leave Tag blank and keep the note. Amounts unchanged. Studio 9.9.475. Variance file not edited.

## WO-394

Cindy cannot send from Edit invoice. That bar was Add item, Save, Cancel, Delete, More. Send was on Client View and Manage. Edit bar now has Send. It saves the lines, then runs send. Variance file not touched. Studio 9.9.474.

Five invoice edit surfaces stay until a scoped review: Edit line items, Manage, Client View, the variance description on a line, and Add item. Not merged today.

## WO-393

Edit INV-6079. Time rows were combined by topic and given a blended rate (lighting 31 hours at 89.03). Complimentary was text stored on the $0 lighting line.

Unsent time invoices with no QuickBooks id now open as one editable line per time entry, grouped by service. The rate is the time entry's rate. INV-6079 total moves from $7,569.92 to $7,570.00. The two unbilled lines stay at $0 under Non-Billable, with their work notes. Studio 9.9.473.

Production hosting 2026-10-29. Studio 9.9.473. No Cloud Functions deploy. No commit.

## Still open from Oct 28

WO-392 variance titles and WO-391 PO address are on production and were not click-tested.
