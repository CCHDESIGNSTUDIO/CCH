# WO-294 DONE — QuickBooks push reminders

Cindy Oct 12: saving a purchase order, emailing the vendor, or saving a bill did not ask to push. After a PO reached QuickBooks, nothing asked about the vendor bill.

## What was already there

Send PO already confirms, then `pushDocToQB` asks “Push this PO to QuickBooks?” Email from that send path does not ask again. The Push bill button still pushes without a second confirm. Studio payments are still never sent.

## What changed

- Save on a purchase order that is not in QuickBooks asks to push the PO (`cchPoRemindPushPo` → existing `pushDocToQB` confirm).
- Email vendor, when it is not the send-and-push path, asks the same question if the PO is not in QuickBooks.
- Saving a vendor bill asks the existing “Push this vendor bill to QuickBooks?” (or sync, if the bill is already there).
- After a PO push succeeds, if a vendor bill is on the PO and not in QuickBooks: “This vendor bill is paid. Push the bill to QuickBooks?” when the bill balance is zero, otherwise “This purchase order has a vendor bill that is not in QuickBooks. Push the bill?”

Staging still does not push. Print/PDF was not touched.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoRemindPushPo`, `cchPoRemindPushBillAfterPo`; bill save calls `cchPoPushBillToQB`; send passes `skipQbRemind`.
- `platform/cch-po-vendor-comms.js` — email calls the PO reminder unless `skipQbRemind`.
- `platform/index.html` — Save PO calls the reminder; successful PO push calls the bill reminder. Studio 9.9.382. Cache `cch-po-bill-variance.js?v=20261012wo294`, `cch-po-vendor-comms.js?v=20261012wo294`.

## Self-test

`node --check` on both scripts, exit 0. Not opened in the browser. Not deployed.

## Verify

Hard refresh production after GO. Save an unpushed PO — one “Push this PO to QuickBooks?” Cancel leaves the PO on Manage. Push a PO that already has a paid vendor bill — second popup offers to push the bill. Save a bill — “Push this vendor bill to QuickBooks?”
