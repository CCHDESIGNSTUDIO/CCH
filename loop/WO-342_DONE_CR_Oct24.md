# WO-342 DONE — T&E invoice line drops VH

Cindy Oct 24. Design Services invoice line showed T&E VH. She asked for VH to come off. The time ledger already mapped that legacy name to T&E. The client invoice title did not.

## Grounding

- `platform/index.html` ~51482. Edit Time Entry rewrites the service `T&E VH` to `T&E`.
- `platform/cch-proposals-invoices-fix.js` `invoiceLineDisplayTitle` ~4813. Returned the stored title as written.
- `platform/cch-invoice-redesign.js` `_outcomeFromLine` ~239. Client View used the saved outcome title first, so the ledger rewrite never reached the invoice.

## Change

A title that is exactly `T&E VH` displays as `T&E` on the invoice line and on the Design Services client sheet. The stored service name is not rewritten.

## Files

- `platform/cch-invoice-redesign.js`
- `platform/cch-proposals-invoices-fix.js`
- `platform/index.html` — cache `cch-invoice-redesign.js?v=20261024wo342` and `cch-proposals-invoices-fix.js?v=20261024wo342`. Studio 9.9.426 with WO-341.

## Self-test

`node --check` on both scripts exited 0.
