# WO-371 DONE — Workroom list stays a list

Cindy Oct 27. The workroom page expanded every purchase order under the name. She wants the list, then the orders when that company is opened, the same way a vendor opens.

## Files

- `platform/cch-functions.js` — Workrooms and receivers are one row each, with a PO count. The name opens that company’s purchase orders. Edit stays on the Edit button.
- `platform/index.html` — `#/workrooms/{id}` and `#/deliveryreceivers/{id}` open that page. Studio 9.9.452.

## Self-test

`node --check platform/cch-functions.js` passed. Not clicked in the browser.
