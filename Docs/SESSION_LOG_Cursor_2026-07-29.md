# Session Log — Cursor: INV Client View line sync + prepaid notes

**File:** SESSION_LOG_Cursor_2026-07-29.md  
**Original Author:** Cursor (CR)  
**Created:** July 29, 2026  
**Last Modified:** July 29, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.1  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Branch:** `wip/preserve-rh-inspiration-board-2026-04-19`  
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Revision history

- v1.0 (Jul 29, afternoon): INV-6054 Client View lineNotes + Pre-Paid Sales Tax totals; QB Description includes lineNotes. Staging hosting + `pushInvoiceToQB` deployed (~14:12). **Not production** (no Cindy GO).
- v1.1 (Jul 29, ~16:30): INV-6006 “new lines won’t save” — Client View was reading stale `clientOutcomes`; live `items` now win. Queued staging v9.9.47 / ds16.

---

## Session overview

Cindy tested staging INV-6006 after prepaid-tax / notes work. Edit showed new lines (pendant, Pre-Paid Sales Tax, Other Expense); Client View still showed old “Powder Bath Renderings.” Document Tags saved — Firestore writes worked; Client View data path did not.

---

## What changed (working copy — v1.1)

| File | Change |
|------|--------|
| `platform/cch-invoice-redesign.js` | `_outcomes` prefers live service `items`; orphan `clientOutcomes` cleared from display; product lines exit DS layout; fee rows include expense/other_expense |
| `platform/index.html` | `docEditSyncLineItemsFromDom` recomputes `amount` from cost/rate; `docEditSave` syncs/clears `clientOutcomes`; CCH_BUILD **9.9.47**; cache `ds16` |

---

## Deploy status

| Item | Target | Status |
|------|--------|--------|
| INV-6054 notes + prepaid + QB | staging hosting + functions | **done** ~14:12 |
| INV-6006 Client View sync | staging hosting | **done** ~16:45 |
| Premium print compact header | staging hosting | **done** ~16:55 (v9.9.48) |
| Production hosting (Cindy GO) | production | **done** ~17:12 — v9.9.48 |
| `pushInvoiceToQB` (lineNotes) | production functions | **done** ~18:30 |

---

## Verify (after #1 deploys staging)

1. Ctrl+Shift+R on https://cch-platform-staging.web.app  
2. Sidebar build **v9.9.47**  
3. Cloud Rolling Hills → **INV-6006** → Edit line items: enter Cost on prepaid/expense, tab out, wait for autosave  
4. **Client View** — must not show deleted “Powder Bath Renderings”; product lines use product Client View; prepaid/expense with amount appear  

---

## Open items

- Room placement P1 built Jul 30 (v9.9.49) — see SESSION_LOG_Cursor_2026-07-30.md
- INV-6054 (etc.): re-push / Update in QuickBooks so existing QB invoices pick up lineNotes
