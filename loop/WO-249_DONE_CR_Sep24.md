# WO-249 DONE — product client price rounds up to the next $0.05

Cindy Sep 24, PRO-3024. Nearest-dollar rounding dropped the cents ($35.11 at 20% is $42.13 and showed as $42). She wants the client unit rounded up to the next five cents so the price stays closer to cost × markup.

## Surfaces

- Affects: proposal client unit (screen, client portal, print) wherever `cchClientUnitFromCostMarkup` rebuilds the price. Invoice document-save uses the same function, so an invoice save nickel-rounds product lines too.
- Does not affect: purchase orders (trade cost), freight / tax / discount / expense lines (stay to the cent), lines already on an invoice (`invoicedOnInvoiceId` / `invoicedAt` keep the stored amount).

## Files

- `platform/index.html` `cchClientUnitFromCostMarkup` ~8830–8839. Product unit: cents, then round up to the next $0.05. An exact nickel stays. Was `Math.round(unit)` (nearest dollar).
- `platform/index.html` `CCH_BUILD` ~4378. `9.9.362` / `client-unit-nickel`.

## Self-test

Node check of the same math at 20%:

| Cost | Exact | Nickel |
|---:|---:|---:|
| 206.50 | 247.80 | 247.80 |
| 35.11 | 42.132 | 42.15 |
| 23.20 | 27.84 | 27.85 |
| 14.80 | 17.76 | 17.80 |
| 819.00 | 982.80 | 982.80 |
| 72.95 | 87.54 | 87.55 |

Saved Firestore prices are not rewritten until a line is edited or the document is saved. Opening a proposal recalculates the line total on screen from cost × markup.

## Not in this order

Room headers on the proposal preview still add the stored `amount`, which can differ from the line total on screen. Save warning for a blank markup or a mixed rate is the next request, not this change.
