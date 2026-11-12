# WO-426 DONE — QuickBooks invoice sends the job ship-to

Cindy Nov 11. Invoice push taxed at Santa Ana because the payload had no ShipAddr.

## Files

- `functions/index.js`
  - `qbStudioJobShipAddr` after `qbPhysicalAddressForPush` (~2712). Reads invoice `shipToAddress`, then project `projectAddress` / `siteAddress` / `jobSiteAddress`.
  - `runPushInvoiceToQBCore` (~1598). After the customer id is resolved, copies that QuickBooks customer's ShipAddr, or BillAddr if ShipAddr is empty. If the customer has neither, uses the Studio job address.
  - Sets `qbInvoice.ShipAddr` (~1730) before the tax total. Line amounts, tax total, and CustomerRef are unchanged.

## What did not change

Invoices that already have a QuickBooks id are not rewritten. A new push, or an allowed update, is what sends the address. Purchase order push is unchanged. Hosting is unchanged. Production functions are not deployed.

## Self-test

`node --check functions/index.js` passed. No invoice was pushed.
