# WO-407 DONE — Pre-paid tax variance tab

Cindy Nov 9, Cloud Rolling Hills bill variances. Pre-paid tax is not Absorbed.

## Change

`platform/cch-po-bill-variance.js`

- Filter chips (`cchPoVarianceFilterChipsHtml`, ~9687): new tab **Pre-paid tax**, on the project page and the firm-wide page.
- `cchPoApplyVarianceRowFilter` (~9512): that tab shows lines whose reason is pre-paid tax, tax, or vendor tax. Pass on and Absorbed are unchanged.
- The running absorbed total no longer adds every tax line. Only a line she marked Absorbed counts.

`platform/index.html` cache `?v=20261109wo407`. Build 9.9.484.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Not click-tested. No Firestore write.
