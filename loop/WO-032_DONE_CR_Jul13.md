# WO-032 DONE · Edit/delete payments on invoice/PO detail + retainer double-count guard · CR Jul 13

**State:** DONE-UNVERIFIED (staging)  
**Staging:** https://cch-platform-staging.web.app  
**Cache bust:** `cch-proposals-invoices-fix.js?v=20260713payedit1`

## Shipped

### Detail-view payment admin (invoice + PO)
- `invoiceAppliedPaymentsPanelHtml` — admin-only ✎ / × on each Applied Payments row (compact rail + full panel)
- `detailDocEditPayment`, `detailDocSavePayment`, `detailDocDeletePayment` — Firestore update, recompute `paidAmount` / `paymentCount` / `status` / `balance`, re-render via `cchRefreshFinDocAfterPayment`
- Reuses `docEditPaymentModalHtml`; QB-sourced payment warning on edit/delete; retainer-linked ref note on delete
- `cchRefreshFinDocAfterPayment` — PO detail path added (`renderPODetail`)

### Retainer double-count guard (INV-6051 pattern)
- `invoiceRetainerDoubleCountInfo` + `invoiceRetainerDoubleCountBannerHtml` — detects credit line + matching retainer payment
- Invoice detail: red banner under header; admin balance rail shows **true owed** (e.g. $1,807.50) with note when clamped math is negative
- `quickRecordPayment` — confirm if new payment would double-count an existing retainer credit line
- `invoiceDocPaymentSummary` — `paymentIndex` maps to original `payments[]` index (not deduped offset)

### renderDocViewPage wiring (`cch-proposals-invoices-fix.js`)
- Passes `_payAdminOpts` into payment panels
- Invoice totals rail uses unclamped balance for admins when double-count detected

## Immediate fix for INV-6051 (no deploy needed)
Delete the **-$2,500 Retainer Credit** line in Edit line items (keep the retainer · INV6016 payment). Total → $4,307.50, paid $2,500, balance **$1,807.50**.

## Verify (Cowork / Cindy)
1. Staging invoice with manual payment: Edit amount → balance updates; Delete → balance restores
2. QB-sourced payment: warning on edit/delete
3. INV-6051 (or similar): double-count banner + admin true balance $1,807.50
4. PO with vendor bill payments: existing `cchPoAppliedPaymentsRailHtml` edit/delete still works; generic PO payments use new detail handlers

## Retainer standardization (pending Cindy decision)
Payment-only (retainer as INV-#### payment) vs credit-line-only — guard warns; no auto-fix yet.
