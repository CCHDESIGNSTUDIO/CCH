# WO-357 DONE — Price/quantity change

State: DONE-UNVERIFIED. Staging Studio 9.9.439. Production waiting on GO.

## What changed

The bill and the variance page say Price/quantity change. A credit still says Price change / credit. A draft invoice that already says Price/quantity increase picks up the new wording when opened.

## Files

- `platform/cch-po-bill-variance.js`
- `platform/index.html` — Studio 9.9.439

## Self-test

`node --check` exited 0. Not clicked through in the browser.
