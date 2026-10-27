# WO-339 DONE — Pay bill amount is the vendor bill

Cindy Oct 24. PO-9047 Pay bill offered $43,069.99. The bill on the right is $38,907.10, and $280.11 is already paid.

The extra $4,443 is the 3/4 Matisse at the PO price. That slab is not on this vendor bill. The pay screen was adding every PO line, then the charges.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoVendorInvoiceGroupTotal` uses the saved `bill.billTotal` when the invoice is the received bill. The pay breakdown drops a PO line that has no invoice line total.
- `platform/index.html` — Studio 9.9.424, tag `pay-bill-amount-is-bill`. Cache `cch-po-bill-variance.js?v=20261024wo339`.

## Self-test

`node --check` exited 0. Live index is 9.9.424. The open payment window was not saved.

PRODUCTION hosting 2026-10-24. Functions not deployed. No commit.
