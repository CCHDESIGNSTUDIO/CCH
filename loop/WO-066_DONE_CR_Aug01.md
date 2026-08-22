# WO-066 DONE — DS invoice expenses frozen delta · Cursor Aug 01

## Status
**Code delta already present in working tree** (prior FABLE implement pass). This session grounded + locked classifier contract; no redesign / no STOP-list violations.

## Grounding (file:line)
| Piece | Location |
|-------|----------|
| Shared type-only classifier | `platform/index.html` `cchInvoiceLineKind` ~37787–37806; `CCH_EXPENSE_PRODUCT_BILLING` ~37771–37783 |
| Redesign uses shared kind | `platform/cch-invoice-redesign.js` `_lineKind` ~28–39; `_isExpenseProductLine` ~205–209 (no title regex) |
| Surface B service style | `platform/cch-proposals-invoices-fix.js` `cchInvoiceLineUseServiceStyleInView` ~1521–1528 → kind === 'service' only |
| Memo Q4 (hide default Terms) | `cch-proposals-invoices-fix.js` ~5012–5017 (`All fees are non-refundable.` stripped; real memo kept) |
| Prepaid tax totals-only | redesign `_passThroughFeeRows` ~248–264 (sales_tax only) |

## STOP list check
1. No title regex in classifier — confirmed (title-only fixture case → `service`)
2. No fee-dump card — prepaid rows only under totals
3. Prepaid tax not in expense/hours body — `_passThroughFeeRows` / kind `prepaid_tax`
4. Default Terms hidden on invoice Print — memo filter above
5–8. No hours layout / renderer unify / manage leak / redesign — not touched this pass

## Golden reference
- Classifier contract: `loop/verify/WO-066_classifier_golden_BY_CURSOR.json`
- Self-test: `node _debug/check_wo066_classifier_BY_CURSOR.js` — all cases pass
- **HTML/screenshot** of staging-native DS invoice = Fable verify (section 6 of decision doc); drop under `loop/verify/` when captured

## Deploy
Staging with WO-065 (db65). Prod only after Cindy GO + Fable section-6 checklist.
