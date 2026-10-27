# WO-296 DONE — Confirmed PO status says Confirmed

Cindy Oct 13. PO-9056, PO-9057, and PO-9059 (Cloud Rolling Hills, Mission Tile West) show Draft even though each order is confirmed.

## What is stored

Read production purchase orders. No write.

| PO | status field | procurementStatus | order conf # |
|---|---|---|---|
| PO-9057 Arto | Draft | Confirmed | S031527 |
| PO-9059 Tabarka | Confirmed lane, status field Draft | Confirmed | SO31527 |
| PO-9056 Artistic Tile | Draft | Confirmed | SO31527 |

`cchPoProcurementLanePanelHtml` printed every step, so Draft stayed on the line with a check after the order was confirmed. Lists that print `po.status` still said Draft because marking confirmed never wrote that field.

## Change

`platform/cch-po-bill-variance.js`

- PO / Order status shows only the current word. A confirmed order says Confirmed.
- An order confirmation number counts as confirmed. Sending or emailing the PO is not required.
- Saving an order conf #, marking confirmed, or saving a confirmation row sets `procurementStatus` and `status` to Confirmed.

`platform/index.html` search, the project dashboard PO row, and the product PO list use that same label. Studio 9.9.384. Cache `cch-po-bill-variance.js?v=20261013wo296`.

## Self-test

`node --check` on `cch-po-bill-variance.js` passed. Not on the live site until a production GO. Print was not changed.
