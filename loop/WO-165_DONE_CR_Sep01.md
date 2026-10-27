# WO-165 DONE — PO Confirm: per-line status In production

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-01  
**Build:** Studio **9.9.308**

## Symptom (Cindy)

Mark as confirmed (PO-9041): per-product STATUS is —, In stock, Ordered, Back-ordered, Shipped, Delivered, Received. No **In production**.

## Surfaces

| Surface | This WO |
|---------|---------|
| Mark as confirmed / Edit order confirmation modal (per-product STATUS) | **Yes** |
| PO-level Shipping / Receiving dropdown | **No** |
| Vendor invoice group order status | **No** |
| Print | **No** |

## Grounding (this turn)

- Modal options from `CCH_PO_LINE_SHIP_STATUSES` at `cch-po-bill-variance.js:795–804`, rendered at `:5121–5127`.
- Saved on `item.lineShipStatus` at `:5248`.
- `cchPoLineShipIsFulfilled` (`:806–809`) does not treat “in production” as shipped (lowercase match list). Leave it that way.

## Change

1. `{ id: 'In production', label: 'In production' }` after Ordered.
2. Status column 104px → 120px so the label fits.
3. Cache buster `cch-po-bill-variance.js?v=20260901inprod1`. `CCH_BUILD` **9.9.308**.

## Files

- `platform/cch-po-bill-variance.js` `:795–804`, `:5124`, `:5132`
- `platform/index.html` `CCH_BUILD` `:4367`; script `?v=` `:89365`

## Self-test

- `node --check platform\cch-po-bill-variance.js` exit 0
- File tails intact

## Verify (after staging deploy)

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **v9.9.308**
2. Open a PO → Mark as confirmed (or Edit order confirmation)
3. Per-product STATUS includes **In production**
4. Save; line ETA chip on the PO shows In production; Shipping lane does not jump to Shipped
