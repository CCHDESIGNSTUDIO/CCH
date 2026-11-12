# WO-370 DONE — Workrooms and receivers show their POs

Cindy Oct 27. Vendors show purchase orders. Workrooms and receivers should too.

## Why they were blank

`renderWorkroomsView` in `platform/cch-functions.js` listed the contact card only. It never loaded purchase orders. Receivers in that same file did the same. The vendor page loads POs by vendor name in `showVendorDetail` (`platform/index.html` ~73679).

## Files

- `platform/cch-functions.js` — `cchPoBelongsToContact`, `cchContactPoRowsHtml`. Workrooms and receivers load every purchase order and list the ones whose vendor, ship-to, workroom, or receiver name matches. Columns match the vendor PO table: PO #, project, vendor, date, status, amount.
- `platform/index.html` — Receivers delegates to that list. Studio 9.9.450. Cache `cch-functions.js?v=20261027wo370`.

## Self-test

`node --check platform/cch-functions.js` passed. Production hosting follows in this pass. Not clicked in the browser.

## Not done

A purchase order shows under a workroom only when the name matches the vendor or the ship-to. No commit.
