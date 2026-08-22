# WO-033 DONE · Invoice line editor — live Subtotal / Tax / Total recalc · CR Jul 13

**State:** DONE-UNVERIFIED (staging)  
**Staging:** https://cch-platform-staging.web.app  
**Cache bust:** `index.html` inline (no separate JS file)

## Shipped

### Live footer during line-item edit
- Replaced static invoice edit footer with `<div id="docEditInvoiceFooterTotals"></div>` — populated on every change
- `invoiceEditFooterTotalsHtml()` — shared footer markup (Subtotal → Shipping → Tax → credit deductions → Total)
- `docEditRecalcTotals()` — no longer early-returns when `#docEditTotals` is missing; updates `#docEditInvoiceFooterTotals` via `invoiceTotalsBreakdown` (same rollup as Save / detail / PDF)
- Wired through existing `docEditRenderItems()` + field-change handlers (qty, cost, markup, category, credit lines, add/delete)

### WO-038 alignment
- Editor footer uses split rollup: work **Subtotal** excludes credits; retainer/discount show as deduction rows; **Total** = subtotal + shipping + tax + credits

## Verify (Cowork / Cindy)
1. Staging invoice INV-6051 (or similar with retainer credit): open Edit line items
2. Footer shows Subtotal **$4,307.50**, Retainer credit **-$2,500**, Total **$1,807.50** while editing (before Save)
3. Add/change/delete a line — footer updates immediately; matches detail view after Save
4. PO line editor footer still recalculates via `#docEditTotals` (unchanged path)

## Not on production
Cindy GO required for `firebase deploy --only hosting:platform --project cch-design-boards`
