# WO-283 DONE — INV-6079 real rates, hours only

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** production Firestore only (no hosting)

## Symptom (Cindy)

Invoice showed $7,569.93 and odd unit prices. Hours should be to the quarter. Dated daily notes on each line are not needed — the hour subtotal is enough.

## Grounding

- Live INV-6079 lighting: `qty` 31, `rate` 89.03, stored `amount` 2760.
- `invoiceLineAmountForTotals` (`platform/index.html:31398-31428`) for design services uses **rate × qty**, not stored amount: `Math.round(89.03 * 31 * 100) / 100` = **2759.93**. Grand total **$7,569.93**.
- Outdoor used blended `$170` (9h @ $195 + 3h @ $95).
- Hours were already quarters (0.25). The weird numbers were pennies from fake blended rates.

## Change

Production `boards/cloud-rolling-hills/invoices/bCqEJW17QgBgGCDpUqqu`:
- Split lighting into 21.75h @ **$95** and 9.25h @ **$75**
- Split outdoor into 9h @ **$195** and 3h @ **$95**
- Rates only **$195 / $95 / $75 / $0**
- Empty `description` / `lineNotes` (no dated day lists). Qty hours stay on the line.
- Complimentary 4.5h @ $0 kept
- `rate × qty` = stored amount = **$7,570**. Hours **66.5**. April only.
- Backup `_backup/wo283-inv-6079-2026-10-07T17-53-42/`

## Verify

Hard refresh INV-6079 Edit: Total **$7,570.00**. Sell/ea is $195 / $95 / $75 / $0. No daily date list in the description. Complimentary $0. Do not re-run AI invoice summary.
