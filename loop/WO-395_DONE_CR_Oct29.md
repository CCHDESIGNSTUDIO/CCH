# WO-395 DONE — Invoice notes stay out of the tag column

Cindy Oct 29. INV-6086, unsent. Freight lines showed the note in the Tag column. She had already written the notes. Stored `lineTag` is empty. Amounts were not changed.

## What changed

Invoices only. Proposals and purchase orders still use the old tag rule.

- `platform/cch-proposals-invoices-fix.js` invoice line table (~3414): Tag is the stored tag only. Notes are the stored notes, including a short first line.
- Same file, Manage notes box (~4371): the notes box shows the stored note. It no longer treats that note as a tag.
- Same file, premium invoice notes (~5422): invoice notes use the stored note.
- Build `9.9.475`, tag `invoice-notes-not-tags`. Script `cch-proposals-invoices-fix.js?v=20261029wo395`.
- `platform/cch-po-bill-variance.js` was not edited. Firestore was not rewritten.

## Self-test

`node --check platform/cch-proposals-invoices-fix.js` passed. INV-6086 read: 10 freight lines, notes like `Invoice #2000339831`, `lineTag` blank, status Unsent, total 8070.75. Click-test not done.

## Verify

Hard refresh INV-6086. Sidebar `v9.9.475`. Tag column is blank. The note under each freight line is still the invoice number. Then Send.
