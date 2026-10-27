# WO-179 DONE — Invoice/Proposal Edit: Taxable checkbox per line
**Executor:** Cursor · **Date:** 2026-09-03 · **State:** DONE-UNVERIFIED

## Problem
Cindy reported she can't see which lines are being taxed on invoice/proposal edit.
Labor lines (expenseType: service) should NOT be taxed but there was no visual indicator.
The only way to check/toggle was buried in "Retail, type & more" detail row.

## Files touched
- `platform/index.html` — `docEditRenderItems` function (~40710–40895)

## What changed (line ranges approximate)

### 1. Colspan bump (~40713–40714)
- `_poLineColspan`: invoice/proposal `13→14` (unit col hidden) or `14→15` (unit col shown). PO unchanged (13).
- `_detailColspan`: invoice/proposal `12→13` or `13→14`. PO unchanged (12).
- Notes row colspan: `11→12` for invoice/proposal. PO unchanged (12).

### 2. Tax column header in thead (~40729)
Added after Shipping `<th>`:
```
(isPO ? '' : '<th style="text-align:center;width:40px;" title="Include this line in sales tax calculation">Tax</th>')
```

### 3. Taxable checkbox per line row (~40875)
Added after Shipping `<td>`, before Total `<td>`:
- Calls existing `docEditTaxableChange(this)` handler (same as "Retail, type & more" checkbox)
- Uses `cchInvoiceLineIsTaxable(item)` to compute initial state (so Labor shows unchecked immediately)
- Design/service lines get `disabled` + cursor:not-allowed + tooltip
- Checked = green accent (#5FA56B), consistent with preview read-only view

### 4. Cache buster
`9.9.310` → `9.9.312`, tag `invoice-taxable-checkbox-2026-09-03`

## Surfaces affected
- Invoice Edit ✓
- Proposal Edit ✓
- PO Edit ✗ (excluded — no tax on POs, column not added)
- Print/PDF ✗ (no change — @media print not touched)

## Self-test
- JS syntax check: OK (no errors in script blocks)
- Labor lines (expenseType: service): `cchInvoiceLineIsTaxable` returns false → checkbox renders unchecked + disabled
- Product lines: checkbox renders checked by default
- Toggle fires `docEditTaxableChange` → sets `_docEdit.items[idx].taxable` → calls `docEditRecalcTotals()` → sidebar tax $ updates immediately

## Verify
1. Open any invoice in Edit mode (e.g. INV-6070 Katke on staging)
2. Confirm "Tax" column appears between Shipping and Total
3. Material A lines: checkbox checked ✓ (green)
4. Labor lines: checkbox unchecked, greyed out (disabled)
5. Toggle a product line's checkbox → sidebar Tax amount should recalculate immediately
6. Save → reload → taxable state persists
