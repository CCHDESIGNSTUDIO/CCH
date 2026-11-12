# WO-385 DONE — Client invoice drops purchase-order text

Cindy Oct 27. The variance invoice lines showed purchase-order prices, or only a vendor invoice number, with no charge type.

## What the client invoice shows

The line description is Freight or Price/qty change. The vendor invoice number is in the line notes. Purchase-order numbers and “PO line $…” are not shown. Amounts were not changed.

Opening the invoice rewrites those lines in place. New variance lines are created the same way.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoCleanClientInvoiceLines` replaces the purchase-order caption with the charge type and moves vendor invoice numbers into `lineNotes`. New variance lines no longer copy the price-compare caption into the description.
- `platform/cch-proposals-invoices-fix.js` — invoice view, manage, and print run that cleanup. Print of a variance line shows the charge type once. Invoice preview text strips leftover purchase-order wording.
- `platform/index.html` — Studio 9.9.465. Cache `cch-proposals-invoices-fix.js?v=20261027wo385` and `cch-po-bill-variance.js?v=20261027wo385`.

## Surfaces

Invoice view, invoice manage, invoice print/PDF, and the tear sheet that prints from that invoice. Proposals and purchase orders are not rewritten.

## Self-test

`node --check` passed on both scripts. The invoice page was not click-tested.
