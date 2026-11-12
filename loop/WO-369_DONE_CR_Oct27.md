# WO-369 DONE — Closed Houzz orders are not Draft

Cindy Oct 27. Old Houzz purchase orders still said Draft. A paid order should count as confirmed. Close the old Houzz ones out.

## What the list was doing

`cchPoProcurementLaneId` in `platform/cch-po-bill-variance.js` (~4074) returns Draft when `procurementStatus` is empty. Production had 2,247 Houzz purchase orders. 2,242 of them had no procurement status, so the badge said Draft. 2,232 of those already had `status: closed`.

## Files

- `platform/cch-po-bill-variance.js` — a closed, paid, installed, received, delivered, or cancelled Houzz order is Confirmed. A vendor bill paid in full is Confirmed. Paying a bill in full writes `procurementStatus: Confirmed`. Closed Houzz orders do not show “No confirmation file attached.”
- `platform/index.html` — Studio 9.9.449, tag `houzz-not-draft`. Cache `cch-po-bill-variance.js?v=20261027wo369`.

## Data

Production `cch-design-boards`. 2,242 purchase orders updated: `procurementStatus: Confirmed` and `procurementConfirmedAt`. Status, totals, payments, and QuickBooks ids were not changed. A recount found 0 Houzz orders still in the draft lane. The one-time script was deleted.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Recount after the write: houzzDraft 0. Production hosting deploy follows in this same pass.

## Not done

Not clicked through the PO list in the browser. No commit.
