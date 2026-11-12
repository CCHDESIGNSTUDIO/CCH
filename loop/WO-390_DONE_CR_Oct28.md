# WO-390 DONE — PO vendor address from the full record

Cindy Oct 28. After WO-389, PO-9050 still showed 2181 Laguna Canyon Rd when OC Custom Furniture was selected.

## Root cause

`cchEnsureVendorsCache` (`platform/index.html` ~30264) stores only `{ id, name }`. `cchLookupVendorRecordByName` returns that cache hit and never reads the vendor document. OC Custom Furniture (`vendors/WzjbhhmGITmdVpsU4od0`) has address `712 Valley #F`, Anaheim, CA 92801.

## What changed

Purchase order edit only. Line costs not written.

- `platform/cch-po-bill-variance.js` — `cchPoDirectoryContactByName` loads the full vendor document when the cache row has no address. Cache `?v=20261028wo390`.
- `platform/cch-proposals-invoices-fix.js` — after the vendor list mounts, the address fill runs for the name already selected.
- `platform/index.html` — that fill is on `window`. Studio 9.9.470.

## Self-test

`node --check` passed on both scripts. The edit page was not click-tested. The vendor document was read. The purchase order was not rewritten.
