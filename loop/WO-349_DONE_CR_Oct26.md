# WO-349 DONE — Bury keeps the other variance checks

Cindy Oct 26. She checked the bill-variance lines for an invoice, clicked Bury on one, and every other check cleared.

## Cause

Bury saves, then redraws the whole Bill variances page. The redraw builds new checkboxes, all unchecked.

## Change

`platform/cch-po-bill-variance.js`. Before the redraw, the checked lines are remembered. After the redraw they are checked again. The line she just buried or passed on is not put back. Adding them to an invoice clears the memory.

`platform/index.html` Studio 9.9.432, tag `variance-checks-stay`. Script `cch-po-bill-variance.js?v=20261026wo349`.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Did not click Bury in the browser.
