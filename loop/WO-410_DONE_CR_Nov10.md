# WO-410 DONE — Import Payments button off

Cindy Nov 10. The Invoices toolbar button Import Payments calls `importPaymentData`. That function loads `payment_compact.json` and writes `payments` and `paidAmount` on matching invoices and POs. The confirm text says about 3,700 documents.

## Change

- Removed the Import Payments button from the Invoices toolbar (`renderAllInvoices`, index.html).
- `importPaymentData` returns immediately and tells the user the import is turned off. The old body is still in the file and does not run.
- Settings card “Import Houzz Payments” no longer points at that button. It says the import is off.
- `importInvoicePaymentsOnly` has no toolbar button. It was not changed.

## Files

- `platform/index.html` — function ~67842, toolbar ~76107, settings card ~75019, Studio 9.9.487

## Self-test

Button string is gone from the toolbar. The function returns before `cchFetchJson('/payment_compact.json')`. No Firestore writes. Production not deployed.
