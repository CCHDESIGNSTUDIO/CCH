# WO-289 DONE — Save returns to Manage

Cindy Oct 12: after Save on a proposal, invoice, or purchase order, Studio often opened the project list instead of that document’s Manage view.

## Grounding

- Save button: `platform/cch-proposals-invoices-fix.js` `cchBuildDocEditTopbar` ~2865 calls `docEditSave(true)` for invoice, proposal, and PO.
- After a successful save, `platform/index.html` `docEditSave` ~42722 navigated to `#/project/{id}/proposals`, `/invoices`, or `/pos`.
- Cancel (~2864) clears the edit session and stays on the current document hash.
- Manage vs Client: `getInvoiceLandingViewMode` ~5922 and `getProposalLandingViewMode` ~5962 default to client unless the session map says manage.
- PO detail is `renderPODetail` ~5670 → `renderDocViewPage` when `_forceEditMode` is false (~49591).

## Change

`platform/index.html` `docEditSave` ~42722–42738.

Save still writes the document. It then opens that same document: invoice and proposal on Manage, purchase order on its detail page. The More menu item “Back to list” is unchanged.

## Self-test

Read-back of the navigation block. File ends with `</html>`. Not a browser pass. Staging deploy follows.

## Surfaces

Proposal, invoice, and purchase order edit Save. Print unchanged. Prices unchanged.
