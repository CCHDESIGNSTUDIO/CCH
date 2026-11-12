# WO-359 DONE — one formula for project and dashboard money

Display only. No invoice, PO, payment, or QuickBooks writes.

## Files

- `platform/index.html`
  - `cchEntryBillRate` and `loggedValueFromTimeEntries` (~4447): logged value uses the rate on the entry. The $250 principal rate is not substituted.
  - `dedupeInvoicesForFinancials` (~4410): same invoice number, and the same QuickBooks or Houzz id, keep the QuickBooks-linked copy.
  - `cchInvoiceDisplayMoney` (~4508): pre-tax, tax, deduped payment rows, overpayment as client credit. A paid invoice with no rows counts its total and is flagged.
  - `cchFinancialSummary` (~4547): one summary. `computeProjectFinancials` calls it, so the project header, sidebar, and Financials tab use it.
  - Financial Health tiles (~4704): invoiced pre-tax, PO cost, gross profit, open invoices, open POs to pay, paid, logged value, design fees, leakage, tax, client credit.
  - Sidebar Hours & Financials (~23936): PO Costs is `poCosts` from that summary, plus Open POs.
  - `_renderDashboardBody` (~7202): company cards and per-project rows call the same summary. Default period is year-to-date and the label shows the dates. Time entries page past the old 5,000 cap.
  - Profit tracker (~51484): same summary. The “Cindy @ $250/hr” caption is gone.
  - `CCH_BUILD` 9.9.441, tag `financial-one-summary`.

## Not changed

Invoice save, PO save, payment save, QuickBooks push, print CSS.

## Self-test

`node --check` on the extracted summary functions passed. Browser check is staging, Cloud Rolling Hills, after a hard refresh. Logged value should move off $441,401.50 toward $231,627.75 when all of that project’s time is loaded. Draft, unsent, and void stay out of invoiced.

## Deploy

Staging. Production waits for Cindy’s GO.
