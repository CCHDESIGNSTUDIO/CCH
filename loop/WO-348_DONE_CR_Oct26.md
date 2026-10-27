# WO-348 DONE — Bill variances can be checked, and the list fits

Cindy Oct 26. Cloud Rolling Hills, Bill variances. Ready to bill was empty. On All she could not click a line to put it on an invoice. The table ran off the right side of the screen.

## Cause

A charge stays off Ready to bill, and has no checkbox, until someone has already clicked Pass on. Pass on and Bury were in the Status column. That column is past the edge because the table does not wrap. She could not reach the click that makes a line ready.

## Change

`platform/cch-po-bill-variance.js`

- A charge that is not buried, not pre-paid tax, and not already on an invoice can be checked. Ready to bill lists those lines.
- Pass on and Bury sit on the line itself, on the left.
- The table wraps to the width of the page.
- Checking lines and Add to client invoice is the bar above the list. Bury still keeps a charge in the studio. Pre-paid tax still cannot be added as its own line.

`platform/index.html` Studio 9.9.431, tag `variance-click`. Script `cch-po-bill-variance.js?v=20261026wo348`.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Did not open Cloud Rolling Hills in the browser before the staging deploy.

Cindy GO. Production hosting ~12:55. Live confirmed version 9.9.431 and `cch-po-bill-variance.js?v=20261026wo348`.
