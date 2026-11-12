# WO-360 DONE — money row is invoices, POs, and profit

Display only. No invoice, PO, payment, or QuickBooks writes. The hours note is a text field on the project.

## Files

- `platform/index.html` — Studio 9.9.442, tag `financial-layout-oct27`
  - `cchFinancialSummary` (~4547): each PO counts once (vendor bill if a bill exists, otherwise the PO amount). Paid and open on that row come from that same figure. Profit is pre-tax invoiced minus that PO total.
  - Financial Health bar: Invoices (invoiced, paid, open), POs/Bills (total, paid, open), Profit. Click POs/Bills for the reconciliation table.
  - Leakage is logged design value not invoiced. When design fees are higher, the line is “+$ billed above logged hours” in green, with a note saved on the project as `finHoursNote`.
  - Needs-attention strip under the money row: Open, Follow-up, Missing. Zero items are hidden. The old Action required invoice and proposal cards are not repeated.
  - Sidebar Hours & Financials and the company dashboard use the same fields.
- `platform/cch-po-bill-variance.js` — exports `cchPoDeriveVarianceComponents` so the reconciliation reads the existing variance lines. Cache `?v=20261027wo360`.

## Self-test

`node --check` on `cch-po-bill-variance.js` passed. The new summary and bar functions parse. Staging verify is Cloud Rolling Hills after a hard refresh.

## Deploy

Staging. Production waits for Cindy’s GO.
