# WO-423 DONE — Client portal Contractors tab

Cindy Nov 11. The list of files and decisions shared with the contractor belongs on the client portal, as its own tab.

## Files

- `platform/cch-contractor-access.js` — `cchContractorPortalListHtml` loads files and decisions with `sharedWithContractors === true`. A file row opens the file. Cache `?v=20261111wo423`.
- `platform/index.html` — client portal sidebar tab Contractors, route `#/clientview/{project}/contractors`. Studio 9.9.500.
- `platform/client.html` — the same tab and route on the client portal page.

## What did not change

Proposals, invoices, purchase orders, cost, and markup are not on this tab. The contractor invite links stay on the studio Contractors page. The contractor's own link is unchanged.

## Self-test

`node --check platform/cch-contractor-access.js` passed. The portal tab was not clicked while logged in before the staging deploy.
