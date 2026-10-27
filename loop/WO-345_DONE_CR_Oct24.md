# WO-345 DONE — client credit

Cindy Oct 24. QuickBooks receipt $4,941.68 on 8/18 is $4,586.25 on INV-6057 and $355.43 on INV-6020. Studio had the whole receipt on one invoice. The QuickBooks warning sat under the payment window, so Save anyway could not be clicked. Vendor credits already move between POs. Client credits did not.

## Files

- `platform/index.html` — Studio 9.9.428. Edit Payment draws the QuickBooks warning above the payment window. Lowering a payment offers to hold the difference as a client credit on that invoice. Record client credit records one that is not tied to a payment. Record Payment method Client credit applies an open credit onto another invoice and lowers the remaining amount. Deleting that payment puts the credit back. Nothing is sent to QuickBooks.
- `platform/cch-project-subpanel.js` — Open credits lists client credits. Picking one while another invoice is open in Edit starts Record Payment with that credit selected.
- `platform/cch-po-bill-variance.js` — Finance → Open credits lists client credits.

## Self-test

`node --check` on `cch-project-subpanel.js` and `cch-po-bill-variance.js`, exit 0. Invoice page script was not run through `node --check`.

## Not done

Did not change INV-6057 or INV-6020 in Firestore. Cindy records the split in the payment window after this is on production.
