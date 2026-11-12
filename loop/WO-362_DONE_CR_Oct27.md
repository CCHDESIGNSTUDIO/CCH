# WO-362 DONE — invoices that need a PO, larger type

Cindy Oct 27, addendum items 8 and 9. Staging only. Display only.

## Files

- `platform/index.html`
  - `cchBuildPoCoverage`, `cchInvoiceLineNeedsPurchaseOrder`, `cchInvoiceLinesNeedingPo` before `cchPoCountsInSummary` (~4535).
  - `cchFinancialSummary` return adds `linesNeedingPo`, `linesNeedingPoCount`, `linesNeedingPoAmount`, `linesNeedingPoPaid`. Coverage uses every PO passed in (`posAll` on the dashboard), not the date-filtered money set.
  - Follow-up strip: “X invoice lines need a PO”. Red when any of those invoices are paid. Click opens the list. Create PO calls `generatePOsFromDoc`. No PO is created by the count.
  - Product and bundle lines only. Design, time, tax, freight, service, retainer, and bill-variance lines are left out. A line already on a non-void PO is left out.
  - Financial health labels 12–13px, notes 13px, strip items 14px, amounts 16px. Groups stack under 1100px.
  - Studio 9.9.443, tag `need-po-font`.

## Self-test

`node` parsed the new helpers. No browser pass in this session. No production deploy.
