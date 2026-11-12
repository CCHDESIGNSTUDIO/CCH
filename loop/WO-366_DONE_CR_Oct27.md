# WO-366 DONE — Cloud variance invoice drops the PO number

Cindy Oct 27. The Cloud variance invoice still showed PO-#### after Studio 9.9.446. The earlier reshape only ran on a draft with no QuickBooks id, and it missed a PO number sitting in the description.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoReshapeDraftVarianceInvoiceLines` (~8570). `cchPoStripPoNumbersFromText`. The single resolve writer no longer titles a line `PO variance — PO-####`.
- `platform/index.html` — Studio 9.9.447, tag `variance-drop-po-number`. Cache `cch-po-bill-variance.js?v=20261027wo366`. Call site unchanged: `renderInvoiceDetail` still awaits the reshape.

## What changed

Opening the invoice removes `PO-####` from the variance line title and description. The title becomes the product or the vendor. Amounts, quantity, and tax are not changed. New lines from Pass on use the vendor name, not the PO number.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Production hosting ~12:30. Live script contains `cchPoStripPoNumbersFromText`. The Cloud invoice itself changes when it is opened after a hard refresh.

## Not done

Not verified by opening INV-6086 in the browser. No QuickBooks push. No commit.
