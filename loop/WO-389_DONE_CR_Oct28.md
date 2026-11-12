# WO-389 DONE — PO vendor pick fills address

Cindy Oct 28 on PO-9050. Selecting OC Custom Furniture left 2181 Laguna Canyon Rd. A save notice at the bottom said Save failed and then a reason she did not catch.

## What changed

Purchase order edit only.

- `platform/cch-po-bill-variance.js` — `cchPoDirectoryContactByName` reads the vendor record, then the workroom record, for address, phone, email, and contact. Cache `?v=20261028wo389`.
- `platform/index.html` — picking a vendor or workroom replaces the Bill to address when that record has one, and shows contact, phone, and email under it. The save payload strips undefined fields. Studio 9.9.469.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The edit page was not click-tested.

Hard refresh Edit PO-9050 and pick OC Custom Furniture again. If that record has an address, the box replaces 2181 Laguna Canyon Rd. If it does not, the notice says no address is on file.
