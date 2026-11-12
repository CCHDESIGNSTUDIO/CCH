# WO-415 DONE — INV-6079 edit lists each time entry

Cindy Nov 11. Edit INV-6079 still showed six combined lines. Rates on those lines were 195, 75, 89.03, 0, 170, and 107.12. The 89.03, 170, and 107.12 rates are not on the time log. She said no made-up rates.

## Data

Production invoice `boards/cloud-rolling-hills/invoices/bCqEJW17QgBgGCDpUqqu` (INV-6079). Status stayed Unsent. No QuickBooks id.

Re-read after the write: 27 lines, one per time entry. Each line rate is the rate on that entry: 195, 95, 75, or 0. Total $7,570.00. No Complimentary category. Each line has its time entry id.

## Code

`platform/index.html`

- `CCH_BUILD` line 5026: 9.9.492, tag `inv6079-each-entry`
- `cchExpandDraftTimeInvoiceItems` around line 65739: an unsent time invoice with no QuickBooks id still splits to one line per entry. The split is allowed when the entry total matches the stored invoice total, even if the combined line amounts do not. The rate on each new line is the time entry rate (`cchTimeEntryInvoiceLine`). The amount is the time entry total. The rate is not amount divided by hours.

## Self-test

Read back the 27 stored lines and the 27 time entries. Rates match. Sum is $7,570.00. File ends at `</html>`.

Production hosting 2026-11-11. Live tag `inv6079-each-entry`.

## Verify

Close the open Edit INV-6079 tab without saving. Hard refresh. Edit should list 27 dated lines. Rates on screen should be 195, 95, 75, or 0 only.
