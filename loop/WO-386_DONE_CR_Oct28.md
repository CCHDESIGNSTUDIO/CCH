# WO-386 DONE — Additional charges stay on Edit bill

Cindy Oct 28 on PO-9072. She likes the Edit vendor bill table. She needs to add a charge, and Vanessa’s separate bills disappeared when Save ran.

## What Save was doing

Edit bill wrote the invoice number from the top of the screen onto every charge. A charge saved under its own invoice number was moved onto that one bill and no longer showed as its own bill.

## What changed

- `platform/cch-po-bill-variance.js` — Edit vendor bill has Additional charges under the line table. Each charge has its own invoice # and note. Save leaves that invoice number alone. A charge with a different invoice number is not poured into the line’s tax and shipping. The purchase order page shows a bill line under each ordered line: invoice #, price, tax, shipping, note, bill total, and the difference.
- `platform/index.html` — Studio 9.9.466. Cache `cch-po-bill-variance.js?v=20261028wo386`.

## Self-test

`node --check` passed. The page was not click-tested. Stored PO-9072 amounts were not rewritten.
