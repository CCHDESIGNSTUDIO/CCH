# WO-224 DONE — Gold Sell/ea on Manage + Edit (proposal and invoice)

**Change ID:** 9.9.344  
**Date:** 2026-09-11  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED

Cindy Sep 11: Cost + markup = **gold client cost (Sell/ea)**, then Total = Sell/ea × qty. She showed Vanessa. That was **WO-213** (Sep 9, 9.9.334) on proposal **Edit**. Invoice Edit hid it (`_hideUnitCol = isInvoice`). Invoice Manage never had it.

## Change

- Invoice **Edit**: show **Sell/ea** (gold), same as proposal Edit.
- Invoice **Manage**: COST (trade) + Mkup % + **Sell/ea** (gold) + TOTAL.
- Proposal **Manage**: COST + Mkup % + **Sell/ea** (gold) + TOTAL (was PRICE-only, no trade Cost).
- Client View: still no trade Cost (WO-221).
- PO Edit: unchanged (no Sell/ea).

## Verify

INV-6064 Manage Ctrl+Shift+R: Gold Extreme COST ~$6,013.64, Mkup 20, **Sell/ea gold ~$7,216.37**, TOTAL $7,216.37. Edit line items: same gold Sell/ea. One proposal Manage: Cost + gold Sell/ea.
