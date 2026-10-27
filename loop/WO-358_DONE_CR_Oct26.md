# WO-358 DONE — Pass on moves to Pending

State: DONE-UNVERIFIED. Staging Studio 9.9.440. Production waiting on GO.

## What changed

Billable and Pending were two names for lines she had passed on. The Billable filter is gone. Pass on marks the line Pending and takes it off Ready to bill. It shows under Pending, still ready to add to an invoice.

## Files

- `platform/cch-po-bill-variance.js`
- `platform/index.html` — Studio 9.9.440

## Self-test

`node --check` exited 0. Not clicked through in the browser.
