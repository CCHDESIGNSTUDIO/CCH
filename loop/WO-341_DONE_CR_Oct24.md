# WO-341 DONE — Variance line is her choice except tax

Cindy Oct 24 GO. Bill variances decided freight, discounts, and price changes for her. Only prepaid tax may stay absorbed. She chooses Pass on or Bury on every other line.

## Grounding

`platform/cch-po-bill-variance.js`

- `VARIANCE_REASON_META` ~256. Freight, price increase, discounts, and credits had a default disposition. Prepaid tax was absorbed.
- `cchPoBuildVarianceTableRowsHtml` ~8156. Undecided lines showed a warning and no way to choose.
- `cchPoVarianceReadyToBill` ~7916 and the component `readyToBill` flag. One undecided line kept the rest of that PO off Ready to bill.
- `cchPoBillAdditionalExpenseFields` ~3478. Charge rows did not carry a saved disposition back onto the list.

## Change

- Prepaid tax stays absorbed and locked.
- Every other line starts undecided until she clicks **Pass on** (bill the client) or **Bury** (studio keeps it).
- The choice is saved on that vendor-invoice charge (`disposition`).
- A line she has marked Pass on can be invoiced while another line on the same PO is still waiting.
- Lines already on a client invoice stay linked.

## Files

- `platform/cch-po-bill-variance.js`
- `platform/index.html` — Studio 9.9.426, tag `variance-you-decide`. Cache `cch-po-bill-variance.js?v=20261024wo341`

## Self-test

`node --check platform/cch-po-bill-variance.js` exited 0.

## Surfaces

Bill variances on the project and in Order Management. Vendor bill totals, payments, and QuickBooks were not changed. Print CSS was not changed.
