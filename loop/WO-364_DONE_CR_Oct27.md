# WO-364 DONE — Mark as confirmed at the top

Cindy Oct 27. Mark as confirmed should be at the top, and Confirm & invoiced stays.

## Files

- `platform/cch-proposals-invoices-fix.js` — PO rail. Status card is first, above Totals. About line 3872.
- `platform/cch-po-bill-variance.js` — Mark as confirmed window. Buttons are under the title: Cancel, Save & mark confirmed, Confirm & invoiced. About lines 6166–6171. Draft button label is Mark as confirmed.
- `platform/index.html` — Studio 9.9.445, tag `confirm-at-top`. Cache `cch-po-bill-variance.js?v=20261027wo364` and `cch-proposals-invoices-fix.js?v=20261027wo364`.

## What changed

The purchase order sidebar leads with PO / Order status, so Mark as confirmed is at the top. Opening it shows Save & mark confirmed and Confirm & invoiced before the order number and the line list. Confirm & invoiced still records the confirmation and opens the bill.

## Self-test

`node --check` passed on both scripts. Staging hosting ~11:55. Live check of the staging page for Studio 9.9.445.

## Not done

Not on production. Production remains 9.9.443. No commit.
