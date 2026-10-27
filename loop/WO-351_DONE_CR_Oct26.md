# WO-351 DONE — Pass or Bury stays where you were

Cindy Oct 26. Every Pass on or Bury jumped Bill variances to the top.

## Cause

Pass on and Bury redraw the list. The first step replaces the page with a short loading line. The scrolling pane is `#contentArea` (`platform/index.html` around line 1650, `overflow-y: auto`). That short line clamps the scroll to the top. The full list then draws there.

## Change

`platform/cch-po-bill-variance.js`. The scroll position is saved before the redraw and put back after. WO-349 still keeps the other checks. WO-350 still hides the raw refund code.

`platform/index.html` Studio 9.9.434, tag `variance-stay-put`. Script `cch-po-bill-variance.js?v=20261026wo351`.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Did not click Pass on in the browser.
