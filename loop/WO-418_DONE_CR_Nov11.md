# WO-418 DONE — Pre-paid tax leaves Undecided

Cindy Nov 11. Pre-paid tax lines on Bill variances showed Undecided, with Pass on and Absorbed. She said that charge is not a decision. It belongs on the Pre-paid tax tab.

## Files

- `platform/cch-po-bill-variance.js`
  - 264–266: tax reason defaults are disposition `prepaid_tax`.
  - 380–381: a stored empty / undecided / pending tax line is treated as pre-paid tax. A line she already marked Pass on or Absorbed stays that way.
  - 9706–9711: status reads Pre-paid tax.
  - 9785: Pass on and Absorbed are not drawn on a pre-paid tax line.
- `platform/index.html` 5029 build 9.9.495. 92353 cache `cch-po-bill-variance.js?v=20261111wo418`.

## What did not change

Pass on and Absorbed on freight, discounts, and price changes. Amounts, paid status, and QuickBooks ids. A tax line already on a client invoice stays on that invoice.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Not clicked in the browser. Staging deploy is the next check.
