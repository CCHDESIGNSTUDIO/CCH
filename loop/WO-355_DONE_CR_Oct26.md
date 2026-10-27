# WO-355 DONE — variance clicks stay put

State: DONE-UNVERIFIED. Staging Studio 9.9.437. Production waiting on GO.

## What changed

Pass on and Bury save the choice and update that line. The page does not reload. Checkboxes were already staying put.

Each line has a note. That note is the invoice description when the line is added. If the line is already on a draft invoice, editing the note updates that invoice description. QuickBooks invoices are not rewritten.

The amber amount color and the tinted row background on the variance list are navy and white.

## Files

- `platform/cch-po-bill-variance.js`
- `platform/index.html` — Studio 9.9.437, `cch-po-bill-variance.js?v=20261026wo355`

## Self-test

`node --check` exited 0. Not clicked through in the browser.
