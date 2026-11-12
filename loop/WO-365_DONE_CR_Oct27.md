# WO-365 DONE — Confirm and invoiced fills the invoice date

Cindy Oct 27. PO-9005 Receive vendor bill left Invoice date empty after Confirm & invoiced. The qty and price arrows were in the way.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoSubmitMarkConfirmed` writes the invoice date on the confirmation when Confirm & invoiced is used. Receive vendor bill copies that date into Invoice date. Class `cch-bill-num` hides the number arrows on qty, price, pre-paid tax, and shipping.
- `platform/index.html` — Studio 9.9.446, tag `confirm-invoice-date`. Cache `cch-po-bill-variance.js?v=20261027wo365`.

## What changed

Confirm & invoiced uses the confirmed date. If that date is blank, it uses today. That date is the Invoice date on the bill. Save & mark confirmed does not fill Invoice date. The up and down arrows are off the quantity, price, pre-paid tax, and shipping boxes.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Staging hosting ~12:05.

## Not done

Not on production. Production remains 9.9.443. No commit. The open PO-9005 bill does not pick up the date until Confirm & invoiced is used again after a hard refresh.
