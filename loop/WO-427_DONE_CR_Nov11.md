# WO-427 DONE — Missing-PO tab is Studio invoices

Cindy Nov 11. The Invoices missing POs tab was listing Houzz invoices (IN-10170, IN-10076, and the rest of that series).

## Files

- `platform/cch-order-management.js` — `cchOmIsStudioInvoice`. The tab keeps `INV-` numbers and Studio numbers stored as `IN-6xxx`. Houzz `IN-10xxx`, `IN-11xxx`, and `IN-12xxx` are left off. Subtitle says Studio invoices only. `OM_BUILD` `20261111wo427`.
- `platform/index.html` — script cache `cch-order-management.js?v=20261111wo427`. Studio 9.9.499.

## What did not change

The project follow-up count still uses `cchInvoiceLinesNeedingPo` with no Studio filter. Drafts stay off. Purchase order amounts are not changed.

## Self-test

`node --check platform/cch-order-management.js` passed. `IN-10170` is excluded. `INV-6065` is kept. The logged-in tab was not clicked before the staging deploy.
