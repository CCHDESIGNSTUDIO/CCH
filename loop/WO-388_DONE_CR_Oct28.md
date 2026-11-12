# WO-388 DONE — PO edit picks a vendor or workroom

Cindy Oct 28 on PO-9050. Universal Upholstery could not make the work. Bill to was a typed name, so there was no list to switch the workroom to OC Custom Furniture.

## What changed

Purchase order edit only (`type === 'po'`). No Vendor column on the lines. Line costs are not written.

- `platform/index.html` — Bill to vendor name is a dropdown. Other / type a name is still there. Save reads the picked name. Studio 9.9.468.
- `platform/cch-proposals-invoices-fix.js` — `mountDocEditPOVendorSelect` fills that list from vendors and workrooms, and keeps the name already on the PO. Cache `?v=20261028wo388`.

## Self-test

`node --check platform/cch-proposals-invoices-fix.js` passed. The edit page was not click-tested. PO-9050 line costs were not rewritten.

Hard refresh Edit PO. Vendor / workroom is a list. OC Custom Furniture stays selected.
