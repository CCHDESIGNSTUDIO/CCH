# WO-285 DONE — Square + QB payments count once, all projects

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** production Firestore (applied 2026-10-07 ~15:40 PT). No hosting.

## Symptom (Cindy)

Katke invoices list: Paid ~2× Total with warning triangles. She thought WO-258 had fixed this everywhere. Asked to check all Square payments for everyone.

## Grounding

- List Paid = `invoiceListRowPayments` → `_invoiceAppliedPaid` (`index.html` ~67092), summing rows unless `countsTowardPaid === false` or `confirmsPaymentId`.
- WO-258 stamped only INV-6069. Functions linker `linkQbRowsThatConfirmSquare` (`Functions/index.js` 2161) requires same date ±$0.05; Katke Square vs QB drifted on amount/date so they both counted.
- Scan: 3 Square-duplicated invoices + 402 Houzz+QB 2×.

## Change

Script `_scripts/stamp-qb-confirms-studio-payments_BY_CURSOR_2026-10-07.js --apply`.

When Square or Houzz already covers the invoice total, counting QB rows get `countsTowardPaid: false` + `confirmsPaymentId`. `paidAmount` set to the studio cash sum. Guard: skip if no studio cash, or studio cash is short of total.

**APPLIED 405 invoices. Square 3.** Backup `_backup/wo285-qb-confirm-2026-10-07T22-40-15`.

Verified after write:

| Invoice | paidAmount | counting |
|---------|------------|----------|
| Katke INV-6070 | 9518.08 | 9518.08 |
| Katke INV-6059 | 2375 | 2375 |
| greene-hixson INV-6066 | 1326.25 | 1326.25 |

Rows kept (QB still visible as confirmation). No hosting. Functions linker not deployed.

## Verify

Hard refresh Katke invoices: INV-6070 Paid **$9,518.08**, INV-6059 **$2,375**, warning triangles gone. Houzz invoices that were 2× should now match Total.
