# WO-401 DONE — quantity change text has no prices

`cchPoChargeItemsFromVendorInvoices` in `platform/cch-po-bill-variance.js` (about 2663). A quantity change with no typed note is "Quantity change from X to Y" plus the unit when the PO line has one. A price change with no typed note is "Price change" and the product name. Unit price and cost are not written into that text. The bill row stores `poQty`. PO line meta stores `unit` when the line has one.

Studio 9.9.479. Production hosting 2026-10-30. Not click-tested. No commit.
