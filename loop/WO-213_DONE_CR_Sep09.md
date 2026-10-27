# WO-213 DONE — Proposal: stop $5 unit ceil; Manage markup + Edit sell/ea

**Change ID:** 9.9.334  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9 PRO-3038 (Reclaimed German Basalt Cobblestone): Edit Line Item showed Client Sell **$30.80** (correct: $28 × 10%) but Line Subtotal **$175,000** ($35 × 5000). Manage had no Markup column. Edit grid had no sell/ea.

## Diagnosis (file:line)

- **$5 ceil:** `cchClientUnitFromCostMarkup` (`index.html` ~8826) called `cchRoundClientUnitPriceUp5` (WO-093 Aug 7): `Math.ceil(n/5)*5`. $30.80 → **$35**.
- **Modal mismatch:** Client Sell used raw `cost*(1+mkup/100)` (`recalcLineItem` ~37152). Line Subtotal on open used stored `item.amount` (`editDocLineItem` ~36644) which had already been $5-ceiled on a prior save.
- **Manage:** `_plManage` table omitted markup by design (`index.html` ~35123 / thead ~35214).
- **Edit grid:** COST + Mkup % + TOTAL, no client unit column.

## Surfaces

| Intended | Must not |
|----------|----------|
| Studio proposal Manage + Edit | Client View / portal markup column |
| Client unit = cost × (1 + mkup%) to the cent | PO math; invoice Tax-in-Total lock |
| Modal Client Sell and Line Subtotal agree | Restyle print Bill To / Ship To |

Print/PDF proposal lines already used unrounded `cost * qty * (1+mkup/100)` (`cch-proposals-invoices-fix.js` ~5222).

## Change

- `cchClientUnitFromCostMarkup` rounds to **cents**, not $5.
- `proposalLineClientTotal`: when cost > 0, live cost×markup (so tables match without waiting for Save).
- Modal open + Save + live recalc use the same unit helper.
- Manage: **Mkup %** column after PRICE.
- Edit: **Sell/ea** after Mkup % (gold, cost+markup).
- `client.html` `proposalLineClientTotal` same live math for portal totals.

Studio **9.9.334** `prop-markup-no-5-ceil-2026-09-09`.

## Self-test

- $28 × 10% → unit **$30.80**; × 5000 → **$154,000.00**.
- Client View header still has no Mkup % column.

## Verify after staging

Hard refresh. Sidebar **9.9.334**. PRO-3038:

1. Edit Line Item — Client Sell $30.80 and Line Subtotal $154,000.
2. Edit grid — Sell/ea $30.80, TOTAL 154,000.00.
3. Manage — Mkup % 10, PRICE $30.80, TOTAL $154,000.
4. Client View — no markup column; price/total still $30.80 / $154,000.
5. One invoice Client View — tax-in-total unchanged.
