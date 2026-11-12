# WO-428 DONE — Cloud Functions runtime off Node 20

Cindy Nov 11. Production GO for the invoice ship-to. Node 20 deploys were refused.

## Files

- `firebase.json` — functions runtime `nodejs20` to `nodejs24`
- `functions/package.json` — engines.node `20` to `24`

No SDK bump. `functions/index.js` was not edited in this order. The ship-to code is WO-426.

## Deploy

Production project `cch-design-boards`, 2026-11-11 20:23. These three only, all Node.js 24 2nd Gen:

- `pushInvoiceToQB`
- `pushInvoiceToQBAutomated`
- `processInvoiceQBPushPending`

`node --check functions/index.js` passed. Other functions were not redeployed. Hosting was not deployed. Not committed.

## Not verified

No invoice was pushed. The next new push is what sends the customer ship-to. Invoices that already have a QuickBooks id are not rewritten.
