# WO-293 DONE — Quantity change, and selecting the item keeps what was typed

Cindy Oct 12. Other had no quantity. Checking the PO item wiped the numbers she had entered. Walker Zanger hold 1160772, customer PO 9060.

## Grounding

`cchPoViPoLineChanged` called `cchPoRefreshPriceChangeRow` with `prefillQty: true`. That branch wrote the PO quantity over whatever was already in the qty field (`cch-po-bill-variance.js`, the refresh around the qty input). Other maps to `extra`, and the unit/qty block only opened for `price_change`.

## Walker Zanger hold

Printed extensions sum to subtotal $6,867.91. Tax $672.64. Total $7,540.55. Rue Pierre 87.50 × $23.83 is $2,085.125; the hold prints $2,085.12.

## Change

Checking the item fills the PO unit only. Qty and invoice line total stay. Type **Quantity change** opens the same qty, unit, and invoice line total fields. A quantity-only line starts with the PO unit price. Variance reason is Quantity change.

Studio 9.9.381. Cache `20261012wo293`. Print was not changed.

## Self-test

`node --check` passed. Not on production until a typed GO.
