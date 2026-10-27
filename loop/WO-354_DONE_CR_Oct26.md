# WO-354 DONE — purchase orders update Airtable

State: DONE-UNVERIFIED. Staging Studio 9.9.436. Production waiting on GO.

## What changed

Saving a purchase order, emailing the vendor, or changing Received / shipping status pushes that one PO to Airtable. No extra confirm. A failed Airtable call does not undo the Studio save. The Airtable button is still there for a manual push.

Receiver line check-ins (qty received, photos) are still left alone. That guard was already in the Cloud Function. This change does not deploy functions.

## Files

- `platform/cch-airtable-push.js` — `cchPushPoToAirtableQuiet`
- `platform/index.html` — after PO save. Studio 9.9.436.
- `platform/cch-po-bill-variance.js` — after shipping status / Received
- `platform/cch-po-vendor-comms.js` — after email to vendor

## Self-test

`node --check` on the three JS files exited 0. Not clicked through in the browser. Existing POs do not backfill until one of those actions, or Push all.
