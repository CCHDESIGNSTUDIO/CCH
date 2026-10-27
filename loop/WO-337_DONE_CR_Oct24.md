# WO-337 DONE — Vendor credit recorded on one PO and applied on another

Cindy Oct 24. The $280.11 overtax credit is on PO-9054. She applies it as a payment on PO-9047. Pay bill had no credit method.

## Files

- `platform/cch-po-bill-variance.js`
  - `cchPoCreditRemaining`, `cchPoOpenVendorCreditTotal`, `cchPoAmountDue` — an open credit lowers the balance on the PO it is recorded on.
  - `cchPoListBalanceForRow`, `cchPoBuildPaymentPatch` — stored balance uses the same open credit.
  - `cchPoOpenRecordCreditModal`, `cchPoSaveVendorCredit`, `cchPoDeleteVendorCredit`, `cchPoVendorCreditsRailHtml` — record the credit on the overtaxed PO.
  - `cchPoConsumeVendorCredit`, `cchPoRestoreVendorCredit` — applying the credit uses it up. Removing that payment puts it back.
  - Pay bill method list includes Vendor credit. The picker lists open credits on this project.
  - Top bar Record credit button.
- `platform/cch-proposals-invoices-fix.js` — Record credit button and Vendor credits block on the PO totals card.
- `platform/index.html` — Studio 9.9.422, tag `vendor-credit-apply`. Cache `cch-proposals-invoices-fix.js?v=20261024wo337` and `cch-po-bill-variance.js?v=20261024wo337`.

## Behavior

Recording a credit on PO-9054 lowers that PO while the credit is open. Pay bill on PO-9047, method Vendor credit, selects that credit and records a Studio payment. PO-9047’s balance drops by the amount. PO-9054’s balance goes back, and the credit shows as applied to PO-9047. Both bills are not lowered. The payment is not sent to QuickBooks.

## Self-test

`node --check` on both JS files exited 0. Live index at https://cch-platform.web.app is 9.9.422 with both cache busters. Diff against the previous live files was the credit change only. The credit was not entered on PO-9054 from this session. Cindy records 280.11 there, then applies it on PO-9047.

PRODUCTION hosting 2026-10-24. Functions not deployed. No commit.
