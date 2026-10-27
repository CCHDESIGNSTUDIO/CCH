# WO-336 DONE — PO page bill total follows the open vendor bill

Cindy Oct 24, PO-9047. Studio 9.9.420 was open. The receive-bill form was changing. The Totals card on the right stayed $38,887.11. That card is the saved bill. It did not listen to the form.

## Files

- `platform/cch-proposals-invoices-fix.js` — Totals card: Merchandise, Shipping, Pre-paid tax, then Bill total. Variance sits under the total. Ids so the open bill can write the live sum.
- `platform/cch-po-bill-variance.js` — `cchPoSyncOpenBillTotals` writes that sum into the Totals card and the line-item bill total while Receive bill is open. Cancel puts the saved numbers back.
- `platform/index.html` — Studio 9.9.421, tag `bill-total-on-rail`. Cache `cch-proposals-invoices-fix.js?v=20261024wo336`, `cch-po-bill-variance.js?v=20261024wo336`.

## Self-test

`node --check` on both scripts exited 0.

## Deployed

PRODUCTION hosting 2026-10-24. The page she had open is still 9.9.420 until a hard refresh.
