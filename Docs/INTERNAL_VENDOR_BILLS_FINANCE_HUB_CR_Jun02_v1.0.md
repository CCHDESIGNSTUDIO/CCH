# Vendor Bills Finance Hub — Agent Handoff

**File:** INTERNAL_VENDOR_BILLS_FINANCE_HUB_CR_Jun02_v1.0.md  
**Original Author:** Cursor (CR)  
**Created:** June 2, 2026  
**Last Modified:** June 2, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0  

**Audience:** Hermes (MH), Claude Code (CC), Cowork (CW1–3), Grok (GK), Cynthia (CB)  
**Workspace:** `CCH-Platform-Deploy` / `cch-deploy/platform/`  
**Session log:** `Docs/SESSION_LOG_Cursor_2026-06-02.md`  
**Workflow spec:** `Docs/SPEC_PO_Bill_Variance_Workflow_v1.0.md`  
**Taxonomy guard (imports):** `Docs/CLEANUP_HISTORY.md` + `.cursor/rules/houzz-taxonomy-import-guard.mdc`  
**Cursor transcript:** [Vendor Bills / PO Bill status / FFE](3928f2fa-8e18-40d2-a544-f177c7bba0f8)

## Revision history

- v1.0 (Jun 2, 2026, CR): Handoff after Vendor Bills hub, PO Bill status column, FFE procurement UI, sidebar/nav changes.

---

## 1. Product intent (read this first)

Cynthia’s direction for all agents:

| Surface | Role |
|---------|------|
| **Vendor Bills** (`#/vendorbills`) | **Payables control tower** — what we owe vendors firm-wide, bill received vs awaiting, paid/balance, QB bill status, variances to client |
| **Purchase Orders** (`#/allpos`) | **Document layer** — lines, send/lock PO, fulfillment status, merge, clip linkage |
| **Bill status on PO lists** | Quick scan: (1) PO **sent** to vendor, (2) **vendor bill generated** in Studio |

Do **not** conflate:

- **`status`** on PO = **fulfillment / FFE** (Sent to vendor, Ordered, Shipped, At receiver, Received goods, etc.)
- **`poStatus` / `bill` / Bill status column** = **procurement + AP workflow** (draft → sent → bill received → paid)

QuickBooks policy (bill-only mode): **`CCH_PO_QB_BILL_ONLY = true`** — push **vendor Bill** to QB, not PO. See `cchPoQbBillOnlyMode()` in `cch-po-bill-variance.js`.

---

## 2. Navigation & routes

### Sidebar — Finance section (`index.html`)

```
Proposals
Invoices
Purchase Orders
Vendor Bills          → #/vendorbills
  Bill variances      → #/vendorbills/variances  (indented shortcut)
```

- **Removed:** standalone “Bill variances” under Intelligence (merged into Vendor Bills page).
- **Removed:** `admin-only-nav` from Vendor Bills (was hiding nav for non-admin emails on staging).

### Routes

| Hash | Page |
|------|------|
| `#/vendorbills` | Vendor Bills tab (default filter: open) |
| `#/vendorbills/open` | Open bills (balance due) |
| `#/vendorbills/pending` | Awaiting bill (sent, no bill yet) |
| `#/vendorbills/paid` | Paid bills |
| `#/vendorbills/variances` | Bill variances tab |
| `#/discrepancyreport` | Legacy → same as variances tab |
| `#/allpos` | All POs (now includes **Bill status** column) |

**Build tag:** `CCH_BUILD.version = '9.8.0'`, `tag = 'vendor-bills-nav'`

---

## 3. Key files & functions

### `cch-po-bill-variance.js` (primary — load before relying on helpers)

| Function | Purpose |
|----------|---------|
| `renderAllVendorBillsPage()` | Firm-wide Vendor Bills + variances page |
| `cchPoCollectVendorBillRows(pos, projNames)` | Rows from `_cachedPOs`; buckets: `open`, `awaiting_bill`, `paid` |
| `cchPoBuildVendorBillsPanelHtml(...)` | Table, summary cards, footer totals, filter chips |
| `cchPoVendorBillQbStatusHtml(r)` | QB column — passes full `_po` to `cchPoQbListCellHtml` |
| `cchPoVendorBillRowActionsHtml(r)` | ⋮ menu on Vendor Bills rows |
| `cchPoListBillWorkflowHtml(po)` | **PO list** two-line Bill status cell |
| `cchPoWasSentToVendor(doc)` | Sent detection: `poSentAt`, `poLocked`, `poStatus`, `procurementStatus`, fulfillment “Sent to Vendor” |
| `cchPoLifecycleStatus(doc)` | draft → sent → bill_received → paid → cleared |
| `cchPoSendToVendor(projectId, poId)` | Locks PO, sets `poSentAt`, logs `sent_to_vendor` to activity |
| `cchPoOpenReceiveBillModal` / payment modals | Bill receive, edit, pay |
| `cchPoVendorBillTotal`, `cchPoPaidTotal`, `cchPoAmountDue` | Money math on bill |
| `cchPoQbListCellHtml(po)` | QB Sync column (All POs + Vendor Bills) |

### `cch-ffe-procurement.js`

- FFE Procurement report: column show/hide (localStorage), print/export modals.
- `cchPoVendorInvoiceMetaForClip` — clip ↔ PO line ↔ vendor invoice group fields.

### `index.html`

- Sidebar nav, route dispatch (`page === 'vendorbills'` → `renderAllVendorBillsPage()`).
- `renderAllPOs()` — added **Bill status** column after **Status**.
- Project tab PO table — same **Bill status** column.

### Script cache bust (verify on staging)

```
cch-po-bill-variance.js?v=20260602f
cch-ffe-procurement.js?v=20260602
```

---

## 4. Vendor Bills page — UI summary

### Tabs

1. **Vendor bills** — firm-wide AP list  
2. **Bill variances** — freight/tax/over PO deltas → client invoice batch

### Filter chips (Vendor bills tab)

Open · Awaiting bill · Paid · All received · All

### Table columns

Project · PO # · Vendor · Vendor inv # · Received · **Total** · **Paid** · **Balance** · **QB Status** · Bill status · **⋮ Actions**

### Summary cards (current filter)

Open bills count · Total · Paid · Balance (+ awaiting bill count in subtitle)

### ⋮ actions (Vendor Bills row)

View/Edit PO · Receive/Edit bill · Add charge · Record payment · Push/sync QB bill · Email PO (**stub**) · Open project

Row click → navigates to PO detail (`#/project/{id}/po/{poId}`).

---

## 5. PO Bill status column (All POs + project PO tab)

Each row shows **two lines**:

| Line | Green | Amber | Gray |
|------|-------|-------|------|
| **Sent** | PO locked/sent (`poSentAt`, Send to vendor) | — | Not sent |
| **Bill** | Bill received (or Bill · Paid) | Awaiting bill (sent, no bill) | No bill |

Tooltips: sent date, sender, vendor invoice #, received date, QB bill ID.

**Implementation:** `cchPoListBillWorkflowHtml` — do not duplicate logic in `index.html`; extend the helper if rules change.

---

## 6. Firestore fields agents must respect

On `boards/{boardId}/purchaseOrders/{poId}`:

```js
poStatus: 'draft' | 'sent' | 'bill_received' | 'paid' | 'cleared' | ...
poLocked: boolean
poSentAt: ISOString
poSentBy: string
poTotalAtSend: number
procurementStatus: string   // e.g. 'Sent to Vendor'
bill: {
  received: boolean
  receivedAt, receivedBy
  vendorInvoiceNumber, vendorInvoiceDate
  billTotal, items[], qbBillId, ...
}
variance: { ... }           // bill vs PO at send
vendorInvoiceGroups: [ ... ] // multi-shipment / partial invoices on PO
```

**Re-import guard:** never overwrite cleaned `category`, `bill`, guarded PO fields on Houzz re-import — see `CLEANUP_HISTORY.md`.

---

## 7. Known gaps & bugs (do not “fix” silently)

| Issue | State | Notes |
|-------|-------|-------|
| `emailVendorPO` | **Stub** | `index.html` ~59620 — alert only; **no** `activityLog` entry. Real email should use `logDocActivity` like `cchPoSendToVendor`. |
| Vendor Bills refresh after modal | **Missing** | Save bill/payment → list may show stale totals until manual refresh |
| PO detail totals rail | **Bug** | Uses PO `total` not `cchPoVendorBillTotal` when bill received |
| Staging vs local | **Drift** | Partial staging deploy; redeploy needed for `20260602f` + Bill status column |
| `emailVendorPO` in ⋮ | **Misleading** | Consider remove until implemented |
| Payment 2×–7× (Houzz) | **Separate** | Not fixed by Vendor Bills UI — dedupe scripts / sync policy |

---

## 8. What NOT to break

Cynthia explicitly protected in parallel work:

- **Product Library** — `#/library`, `/productLibrary`, isolation guards in `cch-doc-isolation.js`
- **Houzz IDs & pricing** on clips/library — do not revert isolation or clip→library mirror without reading `CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md`

PO/bill work touches **`purchaseOrders`** and bill modals only — avoid bulk `index.html` rewrites (monkey-patch architecture).

---

## 9. Suggested next tasks (priority)

1. **Staging deploy** — `firebase deploy --only hosting:platform --project staging`
2. **Refresh hooks** — after bill/payment save, call `renderAllVendorBillsPage()` / `renderAllPOs()`
3. **Email PO** — implement or remove from menus
4. **PO detail rail** — bill-aware totals
5. **Optional UX** — Vendor Bills above POs in sidebar; default `#/vendorbills/open`
6. **FFE** — saved named column views (“Create View”)
7. **PO-9018 seed** — `_scripts/seed-po9018-vendor-invoice-groups_BY_CLAUDE_2026-06-09.js` only with Cynthia `--apply`

---

## 10. Verify checklist (Cynthia or next agent)

- [ ] Staging: Finance sidebar shows **Vendor Bills** (not admin-gated)
- [ ] `#/vendorbills` — tabs, filters, Total/Paid/Balance, QB Status, ⋮ menu
- [ ] `#/vendorbills/variances` — variance panel loads
- [ ] `#/allpos` — **Bill status** column (Sent / Bill lines)
- [ ] Project → POs tab — same Bill status column
- [ ] Page source includes `cch-po-bill-variance.js?v=20260602f`
- [ ] Send to vendor on a test PO → Bill status shows **Sent**; receive bill → **Bill received**
- [ ] Intelligence section — **one** Tasks entry (under Projects), not duplicated
- [ ] Production unchanged unless explicit GO/YES

---

## 11. Deploy & git

- **Staging:** OK when Cynthia asks; hosting only for this work  
- **Production:** requires explicit approval  
- **Git commit:** not done unless Cynthia requests  
- **No destructive** Firestore batch on POs/bills without named confirmation (Anti-Destruction Protocol)

---

## 12. Related docs

| Doc | Use |
|-----|-----|
| `SPEC_PO_Bill_Variance_Workflow_v1.0.md` | Schema + workflow spec |
| `SESSION_LOG_Cursor_2026-06-02.md` | Today’s session log |
| `CLEANUP_HISTORY.md` | Category taxonomy + re-import guards |
| `CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md` | Do not break library |
| `audit-new-houzz-outgoing.js` | PO payment audits (read-only) |

---

*End of handoff — v1.0*
