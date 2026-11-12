# WO-372 DONE — QuickBooks vendor Id on the vendor

Cindy Oct 27. OC Custom Furniture on PO-9050 and the QuickBooks vendor page are the same name. Studio had no stored QuickBooks id, and the edit form had no field for one.

## What was wrong

`resolveQbVendorIdForPush` in `Functions/index.js` uses a numeric `qbVendorId` on the Studio vendor when it is set. OC Custom Furniture (`vendors/WzjbhhmGITmdVpsU4od0`) had that field empty. The edit form in `showNewVendorModal` never showed it, so it could not be typed in. The QuickBooks vendor page is id 1353.

## Change

- Production data: `qbVendorId` set to `1353` on that vendor. Name unchanged. No purchase order, bill, or QuickBooks document was rewritten.
- `platform/cch-functions.js` — Edit vendor / workroom / receiver has QuickBooks vendor Id. Save stores the digits.

## Self-test

Read-back after the write: name OC Custom Furniture, qbVendorId 1353. `node --check platform/cch-functions.js` passed. The next bill push was not run.
