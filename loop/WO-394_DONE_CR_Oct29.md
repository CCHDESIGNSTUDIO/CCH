# WO-394 DONE — Send is on the invoice edit bar

Cindy Oct 29. She is on Edit invoice and cannot send. Vanessa is moving between several editors.

## What changed

- `platform/cch-proposals-invoices-fix.js` `cchBuildDocEditTopbar` (~2908, ~2928, ~2979): invoices get a Send button on the edit bar, and Send in More. It saves the open lines, then calls `sendInvoiceToClient`. Proposals and purchase orders are unchanged.
- Build `9.9.474`, tag `invoice-edit-send`. Script `cch-proposals-invoices-fix.js?v=20261029wo394`.
- `platform/cch-po-bill-variance.js` was not edited.

## Five edit surfaces (not merged)

1. Edit line items — `renderDocEditPage` (`platform/index.html` ~49672)
2. Manage — `renderInvoiceManageLanding` (~4234)
3. Client View — `renderInvoiceDesignServicesClientView` (~4152). Send was already in that top bar.
4. Variance description on the invoice row (~3478)
5. Add item sidebar from the edit bar

## Self-test

`node --check platform/cch-proposals-invoices-fix.js` passed. Click-test not done.

## Verify

Hard refresh Edit invoice. Sidebar `v9.9.474`. Send sits next to Save. It saves, marks the invoice Sent, and opens the email panel.
