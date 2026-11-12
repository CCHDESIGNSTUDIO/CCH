# WO-363 DONE — Receive bill is the purchase order

Cindy Oct 27. Vanessa was working the bill with her. The bill should open as the purchase order and be edited from the vendor invoice.

## Files

- `platform/cch-po-bill-variance.js` — Receive vendor bill table, about lines 3354–3613 (helpers) and the modal in `cchPoOpenReceiveBillModal`. Save stamps `billNote` on each PO line.
- `platform/index.html` — Studio 9.9.444, tag `bill-is-po-row`. Script `cch-po-bill-variance.js?v=20261027wo363`.

## What changed

Receive vendor bill and Edit bill show one row per purchase-order item: Item, Qty, Price, Pre-paid tax, Shipping, Note, Total. The rows start as the purchase order. A change to quantity or price, or pre-paid tax, or shipping, is what the vendor invoice changed. The note is stored on that item and on the charge that goes to the client invoice. The purchase order itself is not rewritten.

Amounts already saved on a bill are kept when the bill is opened again. A charge that is not tied to one item stays on the bill.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Staging hosting deploy ~11:50. Live https://cch-platform-staging.web.app is Studio 9.9.444, cache `20261027wo363`.

## Not done

Not on production. Production remains 9.9.443. No QuickBooks function deploy. No commit. Not verified in the browser by opening a bill.
