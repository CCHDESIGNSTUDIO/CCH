# WO-214 DONE — Nearest dollar on uninvoiced proposal lines; invoiced locked

**Change ID:** 9.9.335  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9: nearest **dollar** (not $5, not cents). Do not change anything already invoiced.

## Diagnosis

WO-213 rounded client unit to cents. Cindy wants nearest dollar. Live cost×markup on every `cost > 0` line would also re-price **invoices** and proposal lines already copied to an invoice (`invoicedOnInvoiceId`).

## Surfaces

| Intended | Must not |
|----------|----------|
| Uninvoiced proposal product lines | Invoice docs (stored `amount` / `invoiceLineAmountForTotals`) |
| $28 @ 10% → **$31** sell/ea | Rewrite invoiced proposal lines |
| Manage markup + Edit Sell/ea (WO-213) | PO merch totals |

## Change

- `cchClientUnitFromCostMarkup`: `Math.round(unit)` (nearest $1). Freight/tax/expense stay cents.
- `proposalLineClientTotal`: if `invoicedOnInvoiceId` / `invoicedAt`, use stored `amount`.
- Pricing fields on invoiced proposal lines: locked (toast).
- Invoice + PO field-save totals: stored `amount`, not live markup.
- Line-item Save on invoices / invoiced proposal lines: keep stored `amount` + `clientPrice`.
- Invoice Edit grid: no nearest-dollar helper.
- Proposal Print/Preview uses `proposalLineClientTotal` (invoiced = stored).

Studio **9.9.335**. `cch-proposals-invoices-fix.js?v=20260909prop214`.

## Verify after staging

Hard refresh. Sidebar **9.9.335**.

1. PRO-3038 uninvoiced cobblestone: Sell/ea **$31.00**, line **$155,000**.
2. Any line with invoiced stamp: total unchanged from Firestore.
3. One existing invoice (e.g. INV-6068): Total / tax-in-total unchanged.
4. Client View: no markup column.
