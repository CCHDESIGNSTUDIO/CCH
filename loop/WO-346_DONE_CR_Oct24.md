# WO-346 DONE — one QuickBooks receipt counts once

Cindy Oct 24. Holtz Hill INV-6057 total $4,586.25, Paid column $9,527.93 with a warning. INV-6020 total $34,813.20, Paid $63,530.89 with the same warning.

## Cause

`invoiceListRowPayments` (`platform/index.html` around 31970) sums every payment row. QuickBooks stored the full receipt ($4,941.68, auto-synced) and the amount applied to this invoice ($4,586.25) as two rows. The dedupe key includes the amount, so both stayed. 4941.68 + 4586.25 = 9527.93. The warning at the project invoice table (around 32448) is `paid > total`.

## Change

`_dedupeInvoicePaymentRows` now drops the full receipt when the same QuickBooks payment id also has the smaller amount applied to this invoice. A lone auto-synced receipt beside one smaller QuickBooks row on the same date is dropped the same way. The list, the invoice rail, and a later save all use that dedupe.

## Self-test

Read the sum and the warning. Did not open Holtz Hill Firestore. INV-6057 should show paid $4,586.25 after refresh. INV-6020 drops a duplicate only when the same QuickBooks payment id was stored twice.

Cindy GO. Production hosting ~16:20. Live confirmed version 9.9.429 and the collapse function is in the production index.

## Not done

Functions were not changed or deployed. A QuickBooks refresh can write the extra row again. The page still shows one amount.
