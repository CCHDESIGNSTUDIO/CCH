# WO-387 DONE — one bill total, variance from the locked PO

Cindy Oct 28 on PO-9072 (Katke / Graceland). Duplicate bills were removed and the remaining bill was paid. The bill total still showed in two places ($324.15 on the rail, $354.94 under the lines and on the combined bar). Variance stayed +$84.14, which is the old bill minus the PO.

## What changed

PO line cost is not written. `cchPoSaveReceiveBill` still does not set `items`.

- `platform/cch-po-bill-variance.js`
  - `cchPoRecordedShipBillTotal` (~1628): sum of ship invoices still on the PO. Confirmations are not bills.
  - `cchPoListBillTotalForRow`: that sum wins over a stale stored `bill.billTotal`.
  - `cchPoPayableBillTotal`: amount due uses the same sum, so a removed duplicate does not leave a balance.
  - `cchPoListVarianceForRow` (unchanged body): variance is that bill minus the locked PO (`poTotalAtSend`).
  - `cchPoViewLineTotalsFooterHtml` (~7141): on a received bill the footer no longer prints a second Bill total. It keeps merchandise, shipping, pre-paid tax, and the variance. PO-only view still prints PO total. Caller is `type === 'po'` in `cch-proposals-invoices-fix.js`.
  - Combined vendor bill bar: no second dollar total. Paid stays. Due shows only when money is still owed.
  - Variance card uses the live variance, not the stale stored amount.
  - Resolve writes that live amount onto `variance.amount` only. It does not touch PO lines.

- `platform/index.html` — Studio 9.9.467, cache `cch-po-bill-variance.js?v=20261028wo387`.

## Not changed

PO item cost, qty, and amount. Stored `bill.billTotal` is left as-is until someone resolves the variance. Proposals, invoices, and tear sheets do not use this footer. Print CSS was not edited. QuickBooks was not pushed.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Page was not click-tested. PO-9072 stored lines were not rewritten.

On PO-9072 after a hard refresh the rail Bills figure is the only bill total. Variance should be that bill minus $270.80 (shipping $20 plus pre-paid tax $33.35).
