# WO-297 DONE — INV-6079 dates stay visible in Edit

Cindy Oct 13 GO. Edit on INV-6079 showed an empty “Short summary” box. The dated descriptions had been removed from the invoice, and the description box was capped at one line.

## Change

`platform/index.html` — the line description box is no longer capped at 36px. It opens to the number of lines in the description. Studio 9.9.385.

Production `boards/cloud-rolling-hills/invoices/bCqEJW17QgBgGCDpUqqu`:

- Meetings, Travel, Lighting, Outdoor, and Misc services got the Oct 7 date lines back in `description` and `lineNotes`.
- Complimentary lighting is back: 4.5 hrs at $0, April 9 and April 14, not billed.
- Qty, rate, and amount on the five existing lines were not changed. Stored total left at 7569.92.

Backup `_backup/wo297-inv-6079-2026-10-13T23-28-35-785Z/`.

## Self-test

Firestore write reported 6 lines and the original amounts. Hosting deploy is the same pass. Print CSS was not changed. Client View still does not show hourly rates.
