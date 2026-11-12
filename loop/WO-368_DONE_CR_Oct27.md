# WO-368 DONE — Variance invoice line names the product

Cindy Oct 27. The line title sometimes showed the vendor and sometimes the product. She wants the product first.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoProductTitlesOnPo`, `cchPoProductNameFromText`. The title is the product on that charge’s purchase-order line. The vendor is used only when there is no product name. `cchPoReshapeDraftVarianceInvoiceLines` rewrites a vendor title on open.
- `platform/index.html` — Studio 9.9.448, tag `variance-product-title`. Cache `cch-po-bill-variance.js?v=20261027wo368`.

## Surfaces

Invoice variance line titles only. Amounts stay. PO numbers stay off.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Production hosting ~12:36. Live script contains `cchPoProductTitlesOnPo`. The Cloud invoice updates when it is opened after a hard refresh.

## Not done

Not verified by opening the Cloud invoice in the browser. No QuickBooks push. No commit.
