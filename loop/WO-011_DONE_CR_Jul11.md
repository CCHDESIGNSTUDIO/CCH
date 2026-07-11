# WO-011 DONE · Retainer Credit line type + negative credit entry · Cursor · Jul 11, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | `cchIsCreditLineType` (discount + retainer_credit); `invoiceLineAmountForTotals` negative path; `docEditRenderItems` / `docEditCreditAmountChange`; expense type dropdown + rate sheet preset; preview/PO merge totals; `_expLabels` |
| `Functions/index.js` | QB mapping: retainer_credit → Other:misc income retainer payment; amount coercion; non-taxable |
| `platform/cch-proposals-invoices-fix.js` | retainer_credit grouped with discount/shipping/tax lines on invoices |

## Behavior

1. New **Retainer Credit** expense type on invoice/proposal lines.
2. Credit lines (discount + retainer_credit) accept negative amounts; product/service keep `min="0"`.
3. Retainer coerces positive entry → negative on blur.
4. QB push uses correct item ref and signed amount for retainer credits.

## Verify (Claude, staging)

- Add Retainer Credit line; enter −500; totals subtract correctly.
- Discount line accepts negative amount (regression).
- Product line still blocks negative via min=0.
- Push test invoice with retainer credit (admin).

## Deploy

Staging: hosting + functions (QB mapping). Queue line appended.
