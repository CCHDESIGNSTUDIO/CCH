# WO-359 — One formula for project and dashboard money

Cindy, Oct 26, 2026. Source: `FOR_CURSOR1_PRODBUG_financial-health-numbers_Oct26.md`.

Display only. Do not change invoice, PO, payment, or QuickBooks save/push.

## What is wrong

- Project header uses `computeProjectFinancials` (`platform/index.html` ~4481). Owner time is re-rated at $250 in `_ownerLaborRateForEntry` (~4699).
- Company dashboard uses `_sumInvoiceAmount` inside `_renderDashboardBody` (~7202) and never calls the project function. Drafts and partial payments are handled differently. Time is capped at 5,000 rows and, on the owner view, filtered to Cindy.

## What “right” means

One function, `cchFinancialSummary`, used by the project header, the project sidebar, the Financials tab, and the dashboard.

- Logged value = billable hours × the rate on the entry. No $250 replacement. Rate 0 and non-billable stay out.
- Invoiced = pre-tax (subtotal + shipping − discounts). Sales tax is its own number.
- Paid = deduped payment rows. A paid invoice with no rows counts its total and is flagged. Overpayment stays visible as client credit.
- Include sent, partial, paid, overdue, open, due, unpaid, invoiced. Exclude draft, unsent, void, cancelled, estimated, clip placeholders.
- PO cost = vendor bill when billed, otherwise the PO total at send. Open POs to pay = amount still due.
- Gross profit = pre-tax invoiced − PO cost.
- Leakage = logged value − design fees invoiced. Negative means over-billed.
- Dashboard default is year-to-date, and the label shows the dates. The same function and the same dates produce the same numbers.

## Check on Cloud Rolling Hills

Logged value at entry rates is $231,627.75, not $441,401.50. Draft, unsent, and void invoices are out of both the header and the dashboard.
