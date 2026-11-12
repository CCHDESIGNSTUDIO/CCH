# WO-398 DONE — freight variance uses the shipping column

Cindy Oct 29. Edit INV-6086 shows freight dollars in Cost and Shipping empty. Freight is not product.

## What changed

- `platform/cch-po-bill-variance.js` — `cchPoBatchAddVariancesToInvoice` (about 10036). A freight, shipping, or expedited variance line is stored with `cost` 0, `amount` 0, `markupPct` 0, and `shipping` set to the charge. `category`, `expenseType`, and `qbCategory` are Freight. QuickBooks maps category Freight to income R3 and expense C2 (Studio Freight/Shipping). Expense variances still use cost and amount. The invoice total counts `shipping` when `amount` is 0, so the freight is not dropped.
- The unused resolve-variance writer (about 8724, after the early return) was given the same money fields so it cannot book freight as cost if that return is removed.
- `platform/index.html` — Studio 9.9.478, tag variance-freight-shipping-column. Script cache `20261029wo398`.

## Not changed

INV-6086 was not read or written. Existing freight lines stay in Cost until Cindy asks for a data move. No production deploy.

## Self-test

`node --check` passed on `cch-po-bill-variance.js`. Staging `https://cch-platform-staging.web.app` serves 9.9.478 and `shipping: isFreight ? amt : 0`. Not click-tested. Not on production.

Staging hosting 2026-10-29. No commit. No Cloud Functions deploy.
