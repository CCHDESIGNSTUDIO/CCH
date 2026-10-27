# WO-248 DONE — Portal invoice due follows the invoice total

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-24  
**Studio:** 9.9.361 `portal-invoice-balance`

## Symptom

Cindy on Cloud Rolling Hills INV-6065. Invoice page and client preview: total $76,084.44, paid $40,000, balance $36,084.44. She said that invoice is correct. Portal home and the Invoices list still showed $28,995.13 due.

## Grounding

- Portal home due and Invoices list Amount both call `cpPortalInvoiceBalance` (`platform/index.html` ~79886, ~79598, ~79623).
- That function returned stored `inv.balance` whenever it was set (`index.html` ~80185 before this change).
- INV-6065 Firestore: `total` 76084.44, `payments` $40,000, `balance` 28995.13. `docEditSave` wrote `total` and tax and did not write `balance` (`index.html` ~42347).
- Invoice page balance is `grandTotal - payments` (`cch-proposals-invoices-fix.js` ~3097).

## Change

`cpPortalInvoiceBalance` in `platform/index.html` and `platform/client.html`: when the invoice has a total, due is total minus payments. Stored `balance` is used only when there is no total.

`docEditSave` now writes `balance` as grand total minus payments so the stored field matches the invoice on the next save.

`CCH_BUILD` 9.9.361.

## Surfaces

| Surface | This WO |
|---------|---------|
| Portal home Open Invoices | Yes |
| Portal Invoices list Amount | Yes |
| Portal Total Outstanding | Yes |
| Invoice page / preview math | Unchanged |
| Paid / void invoices | Still due $0 |

## Verify

Hard refresh portal Invoices for Cloud Rolling Hills. INV-6065 amount due $36,084.44. INV-6075 and INV-6064 still Paid.
