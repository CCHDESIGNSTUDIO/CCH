# WO-315 DONE — Typed invoice line total stays

Cindy Oct 21. Ann Sacks quote 22262191. Invoice line total was unit × qty (Salluto $2,323.45, field $3,122.76, bullnose $469.06). The quote totals are $2,323.52, $3,121.89, and $469.20.

## Grounding

`cchPoRefreshPriceChangeRow` in `platform/cch-po-bill-variance.js` wrote `unitTimesQty` into Invoice line total whenever the edit was not that field. Changing unit or qty replaced a typed total. Amount is still invoice line total − PO line (`cchPoCalcPriceChangeAmount`, ~2029).

## Change

`cchPoNoteTypedInvoiceLine` marks the Invoice line total when it is typed. `cchPoRefreshPriceChangeRow` leaves that number in place when unit or qty changes. A saved line total is marked the same way. Clearing the field lets unit × qty fill it again. Same path on the vendor-invoice group rows. Print was not changed. Freight, tax, and PO merchandise amounts were not changed.

`platform/index.html` Studio 9.9.399, tag `inv-line-total-stays`. Cache `cch-po-bill-variance.js?v=20261021wo315`.

## Self-test

`node --check` exit 0.

## Verify

Hard refresh staging. Open the Ann Sacks bill. On each price-change line, type the quote total in Invoice line total, then leave it:

| Item | Invoice line total | PO line | Credit |
|---|---|---|---|
| Arcilla 3×12 | 3121.89 | 3,887.00 | −765.11 |
| Arcilla bullnose | 469.20 | 582.75 | −113.55 |
| Aveiro hexagon | 1968.62 | 1,560.00 | 408.62 |
| Salluto micro | 2323.52 | 1,798.20 | 525.32 |

Changing qty after that must not put unit × qty back in the box.
