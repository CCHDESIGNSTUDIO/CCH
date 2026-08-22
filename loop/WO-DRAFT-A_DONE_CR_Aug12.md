# WO-DRAFT-A DONE — Variance breakout by reason (v1.1)

**Executor:** Cursor #1 · **Date:** Aug 12, 2026  
**WO:** `Docs/WO-DRAFT-A_variance-breakout-by-reason_CW_Aug11_v1.1.md`  
**State:** DONE-UNVERIFIED (staging)

## Files touched
- `platform/cch-po-bill-variance.js` — reason meta + tax family; derive components from existing charge rows; parent/child grid; selection summary; hard guard in `cchPoBatchAddVariancesToInvoice`; bill-save tax → absorbed; resolve-path tax reject
- `platform/index.html` — cache `cch-po-bill-variance.js?v=20260812varA`; Studio **9.9.149**

## Grounding (this session)
- `VARIANCE_REASONS` / meta @ ~244
- `cchPoPickVarianceReason` @ ~2806 area
- `cchPoBatchAddVariancesToInvoice` write-guard
- §6 audit: 0 linked variances on prod (no client double-charge yet)

## Behavior
- Parent PO row = net variance (not selectable as lump)
- Child rows per charge component; prepaid tax locked/absorbed
- Add to invoice pushes selected **components only**; tax family rejected in write path
- `price_increase` / tariff / cost codes default **taxable YES**; freight **NO**

## Not in this pass
- Inline disposition picker UI for undecided (blocks billing until remapped — defaults applied)
- Dry-run Firestore migration writes
- QB taxable mapping follow-on (§7)

## Verify (staging)
1. Ctrl+Shift+R → v9.9.149
2. `#/ordermanagement/variances` — RH / Bugletrail parents + children
3. Tax child shows lock; freight selectable
4. Selection readout: billable / absorbed / undecided
5. Add freight only → invoice line taxable false; tax cannot be forced through
