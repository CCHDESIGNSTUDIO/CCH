# WO-221 DONE — Invoice Client View: client unit, not trade Cost

**Change ID:** 9.9.342  
**Date:** 2026-09-11  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (production GO from Cindy)

Cindy Sep 11 INV-6064 Client View: Kitchen Gold Extreme showed **Cost $6,013.64** (trade) next to **Total $7,216.37** (client). Clients must never see trade cost. Intended: client price each + qty subtotal.

## Diagnosis (file:line)

- Product invoice Client View is `renderDocViewPage('invoice', …)` — `platform/index.html` ~49083.
- That table always painted **Cost** from `item.cost` — `platform/cch-proposals-invoices-fix.js` header ~3296, cell was `formatMoney(cost)` ~3471.
- Markup was already hidden for invoices (`_showMarkupCol` ~3264). Cost was not.
- Proposal Client View already uses unit client price × qty (`index.html` ~35425: “no trade cost”).
- Invoice Print already uses Qty | Price | Total with Price = lineAmt / qty (`cch-proposals-invoices-fix.js` ~5230, ~5389–5393).

## Change

Invoice Client View Cost column → **Price** = `lineAmtForRow / qty` (client sell each). Total stays `lineAmtForRow` (qty × that unit). PO `renderDocViewPage` still shows trade Cost. Manage / Edit unchanged.

## Surfaces

- **Affects:** invoice Client View (product invoices via `renderDocViewPage`).
- **Does not:** PO view Cost; invoice Manage / Edit; Print (already Price); design-services Client View (`cch-invoice-redesign.js` expense table still labeled Cost).

## Self-test

- `node --check platform/cch-proposals-invoices-fix.js`
- Cache buster `cch-proposals-invoices-fix.js?v=20260911inv221` in `index.html` + `client.html`
- Studio **9.9.342**

## Verify

INV-6064 Client View (Ctrl+Shift+R): Qty, **Price** = client each (Gold Extreme ~$7,216.37 if qty 1), **Total** = qty × Price. No $6,013.64. Manage/Edit may still show trade cost. One PO view Cost unchanged.
