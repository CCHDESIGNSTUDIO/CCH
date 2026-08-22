# WO-038 DONE · Invoice retainer/credit as deduction below subtotal · CR Jul 13

**State:** DONE-UNVERIFIED (staging)  
**Staging:** https://cch-platform-staging.web.app  
**Cache bust:** `cch-invoice-redesign.js?v=20260713ds12` in `index.html`

## Shipped

### Split rollup (`invoiceTotalsBreakdown` in `index.html`)
- `subtotal` = sum of non-credit lines (work/time only)
- `credits` array + `creditTotal` for `retainer_credit` / `discount` lines
- `grandTotal = subtotal + totalShipping + tax + creditTotal` (value unchanged)

### Totals display (Studio detail + editor + rail)
- `invoiceTotalsCreditsRailHtml` / `invoiceTotalsCreditsFlexHtml` — deduction rows under subtotal
- `docEditRecalcTotals` rail + table paths include credit rows
- `invoiceEditFooterTotalsHtml` — live editor footer (WO-033) uses same split

### Line items grid
- `cchGroupDocumentItems` — `retainer_credit` / `discount` excluded from LINE ITEMS grid (already in fix module)

### Client-facing design-services invoice (`cch-invoice-redesign.js`)
- `_grand()` → `invoiceViewTotals` full breakdown
- `_ctx()` — `workSubtotal`, `credits`, `creditTotal`, `tax`, `totalShipping`
- `_totalsBlock()` — Design Services shows **work subtotal** ($4,307.50), then Retainer credit deduction (-$2,500), then Total Due ($1,807.50)
- `_isFeeLine` / `_isServiceLine` — credit lines excluded from outcomes section (retainer no longer buried as a service row)

## INV-6051 pattern (acceptance)
```
Subtotal (work)     $4,307.50
Retainer credit    -$2,500.00
Total               $1,807.50
```
Retainer not in LINE ITEMS grid; same format in detail rail, bottom totals, PDF/print, client view, editor footer.

## Verify (Cowork / Cindy)
1. Staging INV-6051 — detail view subtotal = work total; retainer as deduction; total $1,807.50
2. Client View / PDF — Design Services line shows $4,307.50 (not net $1,807.50); retainer credit row visible
3. Multi-credit (retainer + discount) — each deduction row; grand total unchanged

## Not on production
Cindy GO required for `firebase deploy --only hosting:platform --project cch-design-boards`
