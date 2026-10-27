# WO-356 DONE — Price/quantity increase

State: DONE-UNVERIFIED. Staging Studio 9.9.438. Production waiting on GO.

## What changed

The bill type and the variance reason that said Price increase now say Price/quantity increase. A credit still says Price change / credit.

The bill charge field is Reason. What is typed there fills the note on Bill variances. That note is the invoice description. A draft invoice that already says Price increase gets the new item label when opened. Amounts stay.

## Files

- `platform/cch-po-bill-variance.js`
- `platform/index.html` — Studio 9.9.438

## Self-test

`node --check` exited 0. Not clicked through in the browser.
