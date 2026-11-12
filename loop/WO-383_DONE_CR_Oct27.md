# WO-383 DONE — Variance freight label, notes, rooms, and line image

Cindy Oct 27. Freight and shipping was too small. Notes said Vendor bill variances. New invoices did not carry the room. INV-6088 Saginaw had no image.

## Files

- `platform/cch-po-bill-variance.js` — the variance card and the variance table use the freight label at a larger size. New variance invoice lines copy the room and the product image from the purchase-order line. New invoices are not given the note Vendor bill variances.
- `platform/cch-proposals-invoices-fix.js` — invoice Notes drops that phrase. The freight label on a variance line is larger. Print of that line is invoice variance lines only.
- `platform/index.html` — Studio 9.9.464.

## Data

INV-6088 (`boards/holtz-hill/invoices/d432Ie6bNwqzXG6WAdps`): image fields copied from the purchase-order lines onto Tandem and Saginaw Chandelier. Amounts, rooms, and notes were not changed.

## Self-test

`node --check` passed. The page was not click-tested.
