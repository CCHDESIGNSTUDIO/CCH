# WO-421 DONE — Invoices missing POs tab

Cindy Nov 11. Order Management needs a tab for sent and paid product lines that are not on a purchase order.

## Files

- `platform/cch-order-management.js` — tab `needpo`, label “Invoices missing POs”, after Missing confirmations. Hash `#/ordermanagement/needpo`. Loads each project’s invoices and calls `cchInvoiceLinesNeedingPo` with `allRows: true`. Table: Project, Invoice, Product, Amount, Paid or Sent. Row opens the invoice. `OM_BUILD` `20261111wo421`.
- `platform/index.html` — `cchInvoiceLinesNeedingPo` row cap stays 60 unless `opts.allRows`. Script cache `cch-order-management.js?v=20261111wo421`. Studio 9.9.498.

## What did not change

Draft, void, estimated, and cancelled invoices stay off the list. Time, freight, tax, and service lines stay off. The project financial follow-up still uses the 60-row cap. Purchase order amounts are not changed.

## Self-test

`node --check platform/cch-order-management.js` passed. The tab was not click-tested in the browser before the staging deploy.
