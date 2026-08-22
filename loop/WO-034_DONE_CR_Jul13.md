# WO-034 DONE — QB per-line tax + invoice re-push · CR Jul 13

## Shipped (production)
- **Functions** `pushInvoiceToQB`, `processInvoiceQBPushPending` — sparse update path for already-synced invoices; per-line `TaxCodeRef` defaults services/fees/credits to **NON**; retainer_credit lines included with negative amount to `Other:misc income retainer payment`.
- **UI** — invoice detail shows **🔄 Update in QuickBooks** when `qbDocId` exists; queues `qbPushAllowUpdate` for cloud sync.

## Root cause (audit)
| Line type | Before | Source |
|-----------|--------|--------|
| CCH Design Services | NON ✅ | `qbStudioLineIsDesignServiceCategory` |
| CCH Design Concept / Client Project Support / CCH Admin | TAX ❌ | `qbStudioInvoiceLineTaxable` fell through to `!et` → taxable |
| retainer_credit | dropped on re-push | early return when `qbDocId` existed |

## Fix
- `qbStudioInvoiceLineTaxable`: design/service/CCH title patterns → NON; empty `expenseType` → NON (not TAX).
- `runPushInvoiceToQBCore`: `allowUpdate` + sparse QB `POST invoice` with `Id`/`SyncToken`; `TxnTaxDetail.TotalTax: 0` when no sales tax.
- `pushDocToQB(..., isUpdate=true)` sets `qbPushAllowUpdate` on Firestore queue.

## Verify INV-6051
1. Ctrl+Shift+R on Studio → open INV-6051.
2. Click **🔄 Update in QuickBooks** → confirm.
3. After ~1 min, QB txn 75497 should show: all service lines NON-taxable, **-$2,500 retainer** line, total **$1,807.50**.
