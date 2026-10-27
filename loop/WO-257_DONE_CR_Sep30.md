# WO-257 DONE — Proposal footer tax uses the project rate

Cindy Sep 30: PRO-3047 edit page bottom shows Tax $0.00. It should show the tax.

## Grounding

- Footer is `renderProposalDetail` in `platform/index.html` ~35704. It summed approved lines, then used `parseFloat(prop.taxRate) || 0`.
- PRO-3047 (`boards/cloud-rolling-hills/proposals/JdDenfQ5D8lidtacvdyS`) has no `taxRate`. Project `taxRate` is 9.75.
- `cchDocumentSalesTaxRate` (~31343) already does proposal → project → company. Invoices and the print/PDF calculator call it. This footer did not. POs stay at 0 inside that helper.

## Change

- Proposal page footer (view and edit) uses `cchDocumentSalesTaxRate('proposal', prop, proj)`.
- Tax and total are rounded to cents.
- `CCH_BUILD` 9.9.368 `proposal-footer-tax`.

## PRO-3047 after this

Approved taxable merchandise $4,992.60 (three cabinets at $2,190, minus Linden −$438.90 and Metal Floating Mirror −$1,138.50). Declined cabinets stay out. Tax 9.75% = $486.78. Total $5,479.38.

## Not changed

- Print CSS. Preview already calls `cchDocumentSalesTaxRate`.
- Invoice tax lock. PO tax stays 0.
- Stored proposal `total` was not rewritten.

## Self-test

- `platform/index.html` still ends with `</body></html>`.
- Not deployed. Production after Cindy GO. Hard refresh PRO-3047. Bottom should read Tax (9.75% on $4,992.60) $486.78 and Total $5,479.38.
