# WO-353 DONE — bill variances badge is only lines still to categorize

State: DONE-UNVERIFIED. Staging with WO-352 in Studio 9.9.435. Production waiting on GO.

## What changed

The red Bill Variances count is only charges still waiting for Pass on or Bury. Buried, passed on, already invoiced, and pre-paid tax are not in the number. Ready to bill shows those same waiting lines. Passed-on lines are on Billable. Buried and tax are on Absorbed.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoVarianceNeedsCategory`; Ready to bill / Billable / Absorbed hide the other lines
- `platform/cch-project-subpanel.js` — badge uses that check. Studio 9.9.435.

## Self-test

`node --check` exited 0. Not clicked through in the browser.
