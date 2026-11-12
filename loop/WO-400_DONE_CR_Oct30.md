# WO-400 DONE — vendor invoice save refreshes the bill and the variance

`cchPoSaveVendorInvoiceGroup` in `platform/cch-po-bill-variance.js` (about 7153) no longer copies the old bill total and PO subtotal back over the merged bill. It writes `variance.amount` from the merged bill minus the PO total at send. Other variance fields, including Pass on / Absorbed, stay.

Studio 9.9.479. Production hosting 2026-10-30. Not click-tested. No commit.
