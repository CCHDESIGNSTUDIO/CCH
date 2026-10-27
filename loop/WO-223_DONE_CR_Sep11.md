# WO-223 DONE — Invoice Manage PRICE matches proposal Manage

**Change ID:** 9.9.343  
**Date:** 2026-09-11  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (production — same INV-6064 Cost crisis)

Cindy Sep 11 INV-6064 **Manage**: COST showed trade ($6,013.64) next to TOTAL ($7,216.37). Proposal Manage is QTY · **PRICE** (client each = cost × markup) · Mkup % · SHIP · TAX · TOTAL. Invoices must match. Trade cost stays in **Edit line items**.

## Diagnosis (file:line)

- Proposal Manage thead: `index.html` ~35490 `PRICE` + Mkup %; cells ~35414 unit client price, not `item.cost`. Comment ~35399: trade Cost only in Edit.
- Invoice Manage thead was `COST` — `cch-proposals-invoices-fix.js` `renderInvoiceManageLanding` ~4336.
- Cell was trade input `item.cost` ~4302.

## Change

Invoice Manage: COST → **PRICE** = `lineAmt / qty` (client). Mkup % / SHIP / TAX / TOTAL unchanged. Cost still editable on Edit line items.

## Surfaces

- **Affects:** invoice Manage landing only.
- **Does not:** PO; invoice Print; Client View (already Price in 9.9.342); proposal tables.

## Verify

INV-6064 Manage, Ctrl+Shift+R: Gold Extreme **PRICE ~$7,216.37**, Mkup 20, **TOTAL $7,216.37**. No $6,013.64. Edit line items still shows trade Cost.
