# WO-393 DONE — Time invoice lines keep their own rate

Cindy Oct 29, Edit INV-6079. Combined rows used a made-up rate (lighting qty 31 at 89.03). Complimentary was stored text, not a rate.

## What changed

- `platform/index.html` `cchTimeEntryInvoiceLine` (~65672): rate is the time entry's rate. Hours times that rate is not turned into a new rate. The line note is the description.
- `platform/index.html` `cchExpandDraftTimeInvoiceItems` (~65706): Draft and Unsent time invoices with no QuickBooks id split into one line per time entry, grouped by service, then date. A total gap over $0.25 is left alone. INV-6079 is Unsent, 27 entries, stored totals $7,570.00 against the blended $7,569.92.
- `platform/index.html` `createTimeInvoice` (~65769): new time invoices use the same service-then-date order and the entry rate.
- `platform/index.html` `docEditRenderItems` (~42423, ~42600): the edit cost box shows the stored rate, including 0. It does not divide the line total by hours. Time lines get a service group heading.
- `platform/cch-invoice-redesign.js` `_lineRate` (~164): client view uses the stored rate. It does not divide amount by hours.
- Build `9.9.473`, tag `time-line-own-rate`. Script `cch-invoice-redesign.js?v=20261029wo393`.

## Money

INV-6079 stays Unsent and has no QuickBooks id. Opening it after this build rewrites the six combined lines into the 27 time entries. Total moves from $7,569.92 to $7,570.00. Rates stay 195, 95, 75, or 0. The two $0 lines are the Non-Billable entries (Apr 9 and Apr 14), notes unchanged. The word Complimentary is not written.

Sent, paid, and QuickBooks invoices are not split.

## Self-test

`node --check platform/cch-invoice-redesign.js` passed. Linked time entries for this invoice: 27, sum $7,570.00. The invoice was not rewritten by script. The split runs when the invoice is opened. Click-test not done.

## Verify

Hard refresh Edit INV-6079 (Cloud Rolling Hills). Sidebar `v9.9.473`. Lighting is no longer one line at 89.03. Each day is its own line under its service, at 195, 95, 75, or 0.
