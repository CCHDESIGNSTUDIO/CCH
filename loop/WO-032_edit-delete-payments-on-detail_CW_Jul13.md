# WO-032 · Let Cindy edit / delete payments from the invoice (and PO) detail view, not just record them · CW Jul 13
**Change ID:** pending #1 assign (PAY) · **State:** DONE-UNVERIFIED (staging) · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. Financial data edit. Admin-only. **Staging first; prod on Cindy GO.**

## What Cindy said (Jul 13, on invoice INV-6051)
"I need to be able to edit or delete payments." The invoice detail shows an **Applied Payments** rail
("Jul 9, 2026 · retainer · INV6016 · $2,500.00") with only **Record payment** — no way to fix or remove a
payment that's wrong.

## Grounding (confirmed — the editor already exists, just not exposed here)
- Invoice detail "Applied payments" rail is **read-only**: `renderAppliedPayments`-style block @index.html:26056
  (compact rail @26056-26082); the detail menu offers only `quickRecordPayment(projectId,'invoices',id)` @26301.
- A **full payment editor already exists** but only in the document-editor flow:
  - `docEditPaymentModalHtml(title, fields)` @38682 — the modal (Amount / Date / Method [Check, Credit Card,
    ACH/Wire, Zelle, Cash, Deposit, QuickBooks, Other] / Reference-Note).
  - `docEditAddPayment()` @38719, `docEditEditPayment(i)` @38674 (per-row Edit), `docEditDeletePayment(i)` @38675
    (per-row ×), `docEditSavePayment()` @38714. These render Edit + × on each payment row @38667-38678.
- Payments live as `inv.payments[]` (`{amount, date, method, note/ref/reference, source?}`); paid total and
  balance derive from it (@25904, @25912, @25950). `quickRecordPayment` @38845 is the detail-view writer to
  mirror. Dedup/paidAmount pattern @55783 (`payments, paidAmount, paymentCount`).

## Change — expose Edit + Delete on the detail Applied Payments rail
1. In the invoice detail Applied Payments rail (@26056), render a small **Edit** (✎) and **Delete** (×) on each
   payment row, admin-only (`ADMIN_EMAILS`), matching the doc-editor row controls @38674-38675.
2. Reuse `docEditPaymentModalHtml` for the edit modal (same fields), prefilled from the selected payment.
3. Add detail-context handlers (mirror `quickRecordPayment`'s load/write/re-render, don't depend on doc-editor
   in-memory state):
   - **Edit:** open modal prefilled → on save, replace `payments[idx]`, recompute `paidAmount` = sum, set
     `paymentCount`, recompute **status** (balance ≤ 0.01 → Paid; 0 < balance < total → Partially Paid; balance
     ≥ total → Sent/unpaid), `.update()` the invoice, re-render the detail.
   - **Delete:** confirm ("Delete this $X payment from {date}? This can't be undone, but you can re-record it.")
     → remove `payments[idx]`, recompute the same fields + status, `.update()`, re-render.
4. Apply the same to **PO** detail payments (POs also carry `payments[]` and an Applied Payments rail; the
   procurement side of `renderAppliedPayments` @26082). Reuse the same modal + handlers with `collection='purchaseOrders'`.

## Guardrails (important)
- **QuickBooks-sourced payments:** rows with `source === 'QuickBooks'` (or `_qbPaymentId`) came from a QB
  refresh. Editing/deleting one locally does NOT change QuickBooks, and a later **Refresh from QB** can re-add
  it. On edit/delete of a QB-sourced payment, show a warning: "This payment came from QuickBooks. Removing it
  here won't remove it in QuickBooks, and a QB refresh may bring it back. Fix it in QuickBooks to make it stick."
  Still allow the action (Cindy's call), just warn.
- **Retainer / cross-doc applications:** the example ("retainer · INV6016") is a retainer credit applied from
  another doc. If a payment row carries a link to a source doc (retainer/credit ref), flag on delete that the
  linked credit on the source doc is not automatically restored — verify the retainer-credit linkage before
  finalizing (report what you find; if there's no back-link, treat it as a plain payment row).
- Admin-only. Non-admins keep the read-only rail. No client-portal exposure.
- Recompute must keep invoice `status`, `paidAmount`, and the Balance tile consistent (the $1,807.50 balance in
  Cindy's screenshot must update correctly after an edit/delete).

## ADDED (Jul 13) — retainer double-count guard (the reason this surfaced)
INV-6051 (Manno) exposed a double-count: the $2,500 retainer is applied BOTH as a `-2500` **Retainer Credit
line** (expenseType retainer_credit/discount, which lowers the invoice total) AND as a **$2,500 applied payment**
(`method:'retainer'`, ref `INV6016`, which lowers the balance). Result: total $1,807.50, paid $2,500, balance
clamps to $0 when Fred actually still owes **$1,807.50**. The negative pre-clamp balance (-$692.50) is the tell.
- Add a **guard/warning** when a doc contains BOTH a retainer/credit LINE and a retainer-referenced PAYMENT for
  (approximately) the same amount: flag "This retainer may be counted twice — once as a credit line and once as
  a payment. Keep one." Show on the invoice detail near the balance and when recording a retainer payment on a
  doc that already has a retainer credit line (and vice-versa).
- Do NOT auto-delete either side (Cindy's accounting call) — just surface it so it can't silently zero a balance.
- Balance display: keep the ≥0 clamp for the client view, but for the admin/detail view show the true math when
  it goes negative (e.g., "Overpaid / double-applied -$692.50") so the error is visible, not hidden by the clamp.
- Tie-in: this is the standardization thread — a retainer should be represented once (either the INV-#### payment
  application OR a credit line, not both). The guard makes the wrong state visible until the model is unified.

## Acceptance (binary)
0. On a doc with both a retainer credit line and a matching retainer payment, an admin sees a double-count
   warning and the true (unclamped) balance; the client view stays clamped at $0.
1. On an invoice detail with a payment, an admin sees Edit and Delete on each Applied Payments row.
2. Edit opens the prefilled modal; saving changes the amount/date/method and the Totals (Paid, Balance) and
   status update immediately and persist.
3. Delete (after confirm) removes the payment; Paid, Balance, and status recompute and persist.
4. Editing/deleting a QuickBooks-sourced payment shows the QB warning first.
5. Same works on a PO detail. No console errors; index.html tail intact.

## Verify (Claude, staging)
On a staging invoice with a manual payment: edit the amount (confirm Balance updates), delete it (confirm it's
gone and Balance returns to full). Try a QB-sourced payment (confirm warning). Repeat on a PO. Screenshot to
loop/verify/WO-032/.

## DONE note
loop/WO-032_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
