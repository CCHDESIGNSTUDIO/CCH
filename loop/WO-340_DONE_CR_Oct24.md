# WO-340 DONE — Typed invoice line total is not replaced

Cindy Oct 24. PO-9060. Typing an invoice line total was replaced on each keystroke by unit price × qty.

## Grounding

`platform/cch-po-bill-variance.js`

- `cchPoPriceChangeBlockHtml` ~2103. Invoice line total input. `oninput` calls `cchPoVigPriceChangeChanged` or `cchPoViPriceChangeChanged`.
- `cchPoRefreshPriceChangeRow` ~2182. When the line was not marked typed, `lineEl.value = calc.unitTimesQty` on every unit-price or qty keystroke.
- `cchPoViPriceChangeChanged` ~2283 and `cchPoVigPriceChangeChanged` ~2358. Those handlers cleared `data-typed` whenever the keystroke was not in the line-total box, so the next unit-price keystroke was allowed to replace the total.

## Change

- A typed invoice line total keeps `data-typed="1"`. Unit price and qty no longer clear that flag.
- `cchPoRefreshPriceChangeRow` does not write unit × qty over a box that has `data-typed="1"`.
- A saved line total is marked `data-typed` when the row is drawn, so opening the editor does not replace it.
- Unit price and qty still fill the line-total box when it is empty.
- The Amount box is still the difference between that total and the PO line. It moves to match the total. The total box does not.

## Files

- `platform/cch-po-bill-variance.js` — price-change block HTML, `cchPoRefreshPriceChangeRow`, `cchPoViPriceChangeChanged`, `cchPoVigPriceChangeChanged`
- `platform/index.html` — Studio 9.9.425, tag `typed-line-total-stays`. Cache `cch-po-bill-variance.js?v=20261024wo340`

## Self-test

`node --check platform/cch-po-bill-variance.js` exited 0.

Not deployed. Cindy is in the vendor-invoice window on production. A refresh would close it. Production needs her typed GO.

## Surfaces

Vendor invoice edit and Receive bill price-change rows. Freight amount is not this calculator. Proposals, invoices, POs, and tear-sheet print were not touched.
