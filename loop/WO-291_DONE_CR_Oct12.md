# WO-291 DONE — Price change shows the invoice line total

Cindy Oct 12. Ann Sacks quote 22262191 (PO-9055, Rolling Hills) was not matching the bill. Tile qty and the vendor Total Value do not equal net price times quantity.

## Quote (signed PDF)

Item subtotal $7,883.23, freight $815.00, final $8,698.23.

| Line | Qty | Net | Total Value |
|---|---|---|---|
| Arcilla Blanco Matte 3x12 | 261.100 SF | 11.96 | 3,121.89 |
| Arcilla bullnose 1x12 | 45.276 LF | 10.36 | 469.20 |
| Aveiro Black Hexagon 3" | 61.589 SF | 31.96 | 1,968.62 |
| Salluto Bianco Micro Mosaic | 38.750 SF | 59.96 | 2,323.52 |

## Grounding

`cchPoCalcPriceChangeAmount` in `platform/cch-po-bill-variance.js` set the adjustment to (invoice unit − PO unit) × qty. That misses a quantity change (Salluto PO is 30 SF / $1,798.20; the quote is 38.750 SF / $2,323.52) and it is not Ann Sacks’ Total Value.

## Change

Each price-change row has **Invoice line total**. It starts as invoice unit × qty. She can type the quote Total Value. The amount becomes invoice line total − PO line. The bill preview shows **Line total** under that item. Qty accepts thousandths. Print was not changed.

Studio 9.9.379. Cache `20261012wo291` on `cch-po-bill-variance.js`.

## Self-test

`node --check` passed. Not on the live bill until a production GO.

## Not changed

Freight, tax, QuickBooks push, PO merchandise amounts.
