# WO-350 DONE — Bill variance status does not say refund due to client

Cindy Oct 26. The PO row on Bill variances showed `refund_due_client` in Status.

## Cause

`cchPoVarianceStatusLabel` in `platform/cch-po-bill-variance.js` printed the stored `variance.resolution` when it was not pending or billable. Those POs already had the code `refund_due_client` saved on them. The list printed that code.

## Change

The PO row Status no longer prints that code. It shows Billable, Pending, Absorbed, On invoice, or a dash. The same label is used on the PO variance card. The line under the PO is still Pass on or Bury.

`platform/index.html` Studio 9.9.433, tag `variance-status-plain`. Script `cch-po-bill-variance.js?v=20261026wo350`. This build also has WO-349 (Bury keeps the other checks).

## Self-test

`node --check platform/cch-po-bill-variance.js` passed.
