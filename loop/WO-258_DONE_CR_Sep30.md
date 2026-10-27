# WO-258 DONE — Square payment plus QB confirmation counts once

Cindy Sep 30: INV-6069 still shows a double payment. She wants the Square payment and a QuickBooks confirmation. Both. Not added together.

## Grounding

- Payments on `boards/cloud-rolling-hills/invoices/9G8eXBOgwxnZa0c3HxrT`: Square $27,580.70 and QB payment 75884 $27,580.70, same date 2026-09-21.
- Project invoice list Paid column is `invoiceListRowPayments` → `_invoiceAppliedPaid`, which summed every row (`platform/index.html`). That is the $55,161.40 and the warning triangle (`tp > it`).
- QB refresh and the QB webhook append a payment when the QuickBooks id is new. They did not treat a Square row of the same amount and date as the same money (`Functions/index.js` `mergeQbPaymentRowsIntoPatch`, `qbWebhook`).

## Change

- A QB row that matches a Square payment (amount within $0.05, same date) is kept and marked `countsTowardPaid: false` with `confirmsPaymentId`. Paid sums skip it.
- Applied payments still show both. The QB row is labeled confirmation, not a second amount applied.
- INV-6069 updated in production Firestore. Backup `_backup/wo258-inv6069-payments-2026-09-30T19-38-37-141Z.json`. `paidAmount` $27,580.70. Both rows kept.
- `CCH_BUILD` 9.9.369. Production hosting 2026-09-30 ~12:40 Cindy asked for the live invoice.

## Not deployed

- Cloud Functions. `Functions/index.js` has the same link so the next function deploy will not add the dollars again. This hosting deploy does not ship that file. A Refresh from QuickBooks on the old function can write `paidAmount` back to the sum of both rows. The page Paid column uses the rows and skips the confirmation, so the list stays at $27,580.70.

## Self-test

- `node --check Functions/index.js` passed.
- Live build 9.9.369 after hosting deploy.
- Firestore read-back: Square counts, QB `countsTowardPaid` false, `paidAmount` 27580.7.
