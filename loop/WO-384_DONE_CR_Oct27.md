# WO-384 DONE — Buried variances leave the working list

Cindy Oct 27. She marked Bury and the charges still showed on Bill variances.

## What was already saved

Bury is stored as absorbed. On Cloud Rolling Hills the price credits were already buried. The rows still on the list were stored as Pass on: PO-9060 $49.75, PO-9046 $498.06, PO-9032 $52.50 freight.

## Files

- `platform/cch-po-bill-variance.js` — the purchase-order summary skips buried charges (`cchPoVarianceChargeSummary`). Buried lines are omitted unless the Absorbed filter is on (`cchPoApplyVarianceRowFilter`). Clicking Bury removes that row (`cchPoPaintVarianceDisposition`).
- `platform/index.html` — Studio 9.9.464. Cache `cch-po-bill-variance.js?v=20261027wo384`.

## Self-test

`node --check` passed. The page was not click-tested.
