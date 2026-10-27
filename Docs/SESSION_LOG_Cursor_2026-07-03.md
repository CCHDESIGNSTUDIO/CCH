# Session Log — Cursor: Invoice Client/Manage landing restore (Jul 3, 2026)

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Build:** v9.8.14 · `cch-proposals-invoices-fix.js?v=20260703invmanage1`

## Overview

Restored invoice **Client View / Manage** toggle on the main invoice page (default **Client View**). Manage landing ports proposal-style **drag reorder**, **create group from selected**, **bulk set room**, inline vendor/room/markup edits. **Edit line items** unchanged for deep edit (images, full line editor).

## Changed files

| File | Change |
|------|--------|
| `platform/index.html` | `getInvoiceLandingViewMode` / `setInvoiceLandingViewModeUI` / topbar toggle wrap; invoice group/drag helpers; `renderInvoiceDetail` routes Manage → `renderInvoiceManageLanding`; CSS `#invoiceManageArea`; v9.8.14 |
| `platform/cch-proposals-invoices-fix.js` | `renderInvoiceManageLanding` (Manage table + totals) |
| `_DEPLOY_QUEUE.md` | Staging queue invmanage1 |

## NOT deployed

Staging hosting only queued — #1 deploy when batch runs.

## Verify (after staging deploy)

1. Hard refresh staging · build **v9.8.14**
2. Open **IN-12946** (Cloud Rolling Hills)
3. Default = **Client View** (bill-to, line items, rail totals)
4. Toggle **Manage** → drag ⋮⋮, select rows → **Create group from selected**, **Bulk Actions → Set room**
5. **✏️ Edit line items** still opens full editor (images, markup)

## Open

- Batch B propui1 → production (Cindy GO, separate queue line)
- Production GO for invmanage1 after staging sign-off
