# WO-343 DONE — Bill Variances count

Cindy Oct 24. Bill Variances in the project panel had no number. Invoices and Purchase Orders already show a count.

## Files

- `platform/cch-project-subpanel.js` — `spLoadCounts` counts variance component rows that are not on a client invoice and are not buried. Prepaid tax is absorbed, so it is not in the count. Undecided and Pass on lines are. Orange badge on Bill Variances. `window._cchSpReloadCounts` refreshes it.
- `platform/cch-po-bill-variance.js` — after Pass on / Bury, and after adding lines to an invoice, the project count reloads. Around the end of `cchPoSetVarianceLineDisposition` and `cchPoBatchAddVariancesToInvoice`.
- `platform/index.html` — Studio 9.9.427, tag `variance-count`. Cache `cch-project-subpanel.js?v=20261024wo343` and `cch-po-bill-variance.js?v=20261024wo343`.

## Self-test

`node --check` on both JS files, exit 0. Count uses `cchPoCollectVarianceRows` component rows (`rowKind`, `invoicedOnId`, `disposition`) at `cch-po-bill-variance.js` around 8671.

## Not done

Production hosting. Staging deploy in this session. Cindy has not typed GO for 9.9.427.
