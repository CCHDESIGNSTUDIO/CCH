# WO-409 DONE — Time invoice edit is one line per date

Cindy Nov 10, INV-6079 edit. Six combined lines showed invented rates (89.03, 107.12) and a category Complimentary.

## Cause

The invoice stored one line per bucket. The rate on those lines was not a time-log rate. The time log has 27 entries at 195, 95, 75, or 0. Opening the invoice refused to split them because the bucket line amounts ($7,623.75) did not match the entry total ($7,570.00). The stored invoice total was $7,569.92, eight cents from the entries. The Complimentary label was on the stored line, not in code. Those two days are logged Non-Billable at rate 0.

## Change

- `cchExpandDraftTimeInvoiceItems` in `platform/index.html` also splits when the entry total matches the stored invoice total within 25 cents, not only when it matches the collapsed line amounts. Each new line keeps that entry’s rate and amount. No rate is computed from amount divided by hours.
- INV-6079 items rewritten from the 27 time entries. One line per date. Rates 195, 95, 75, and 0. Complimentary is gone. Total $7,570.00. Unsent, no QuickBooks id. Status not changed.

## Files

- `platform/index.html` — expand guard ~65709, Studio 9.9.486
- Firestore `boards/cloud-rolling-hills/invoices/bCqEJW17QgBgGCDpUqqu` items, total, trackedValue

## Self-test

Re-read after write: 27 lines, total 7570, zero lines containing Complimentary. Rate counts: Blended Design Services 195 × 10, Client Project Support 75 × 5, Design Concept 95 × 3, Project Management 95 × 6, Non-Billable 0 × 2, T&E 75 × 1.
