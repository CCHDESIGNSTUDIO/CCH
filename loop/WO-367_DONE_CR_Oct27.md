# WO-367 DONE — Variance invoice names the original invoice

Cindy Oct 27. The new variance invoice should show which original client invoice each charge came from.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoLinkedClientInvoice`. Opening a variance invoice stores `sourceInvoiceNum` from the purchase order’s linked client invoice. New lines store it when they are added.
- `platform/cch-proposals-invoices-fix.js` — variance rows (`type === 'invoice'` and `source === 'po_bill_variance'`) show “Original invoice INV-####” above the note. The tax checkbox stays off the print.
- `platform/index.html` — Studio 9.9.448. Cache `cch-proposals-invoices-fix.js?v=20261027wo367`.

## Surfaces

Invoice variance lines only. Proposals, purchase orders, tear sheets, and other invoice lines are unchanged. Amounts are unchanged.

## Self-test

`node --check` passed on both scripts. Production hosting ~12:36. Live script contains the lookup. The Cloud invoice updates when it is opened after a hard refresh.

## Not done

Not verified by opening the Cloud invoice in the browser. No QuickBooks push. No commit.
