# WO-292 DONE — Bill and variance show PO vs invoice price

Cindy Oct 12. She could not see the vendor invoice price against the PO price on the bill, the variance report, or the client invoice line.

## Grounding

- Bill breakdown `cchPoBillBreakdownTableHtml` listed a price change as one dollar amount. Unit price, qty, and line totals were dropped in `cchPoBillAdditionalExpenseFields`.
- Variance rows in `cchPoBuildVarianceTableRowsHtml` showed the variance amount and a reason label.
- Adding a variance to a client invoice (`cchPoBatchAddVariancesToInvoice`) wrote qty 1 and the difference only. The description had no PO price or invoice price.

## Change

A price-change line now carries: item, PO line, invoice unit × qty = invoice line, and the difference. That line shows on the vendor bill, the bill preview, the vendor-invoice total on the PO, each Bill variances row, and the client invoice line description when the variance is added. The dollar amount billed stays the difference.

Studio 9.9.380. Cache `20261012wo292`. Print was not changed.

## Self-test

`node --check` passed. Not on production until a typed GO.
