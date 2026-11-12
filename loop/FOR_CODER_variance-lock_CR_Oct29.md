# For Coder — variance lock (Cindy Oct 29)

Cursor stops editing `platform/cch-po-bill-variance.js` until this list is agreed. No more layout passes.

Cindy Oct 29, later: step back. Vanessa cannot tell which editor is the invoice. Five surfaces, all still in the product:

1. Edit line items — `cchBuildDocEditTopbar` / `renderDocEditPage` (`platform/index.html` ~49672, top bar in `cch-proposals-invoices-fix.js` ~2892)
2. Manage — `renderInvoiceManageLanding` (~4234)
3. Client View — `renderInvoiceDesignServicesClientView` (~4152)
4. Variance description on the invoice row — `saveInvoiceVarianceDescription` (~3478)
5. Add item sidebar — `openDocItemsSidebar` from the edit bar

Do not merge those today. The send blocker is separate: the edit bar had Add item, Save, Cancel, Delete, and More. Send was only on Client View and Manage. WO-394 puts Send on the edit bar. It saves, then calls `sendInvoiceToClient`. Variance file not touched.

## Her rules, this morning

- The purchase order stays locked. Do not rewrite PO line cost, qty, or amount from a bill.
- Bills are their own layer. QuickBooks cares about the bill. The bill still connects to the PO.
- A PO can have more than one bill. Vendors bill when they ship.
- Every variance is its own line, with its own description. Do not mash them, and do not put the description in the Tag column.
- Do not keep changing the layout.

## Spec

`Docs/SPEC_PO_Bill_Variance_Workflow_v1.0.md` (May 27, 2026).

The spec’s single `bill` object is older than the way she works. She bills per shipment. Multiple bills on one PO override that part of the spec. The locked PO and “variance is its own line” parts still stand.

## Tag bug (the screenshot)

She added two items. On the Other line, “Bracket for wall mount” showed in the Tag column.

The invoice line table reads the tag through `cchLineTagText`:

- `platform/cch-proposals-invoices-fix.js` line 3409 sets `lineTag` from `cchLineTagText(item)`.
- `platform/index.html` `cchLineTagText` (~10275) has no stored tag, so it uses the first note line when that line is 32 characters or shorter. “Bracket for wall mount” is 22 characters.
- The print/preview path in the same file (~5249) already says invoices must not do this. It uses `cchLineTagExplicit` only.

That is a display bug on the invoice table. It is not a variance-layout change. Confirm on her invoice before editing. Do not retitle variance lines while fixing the tag.

## What Cursor already shipped on variance (do not redo)

Production, through Studio 9.9.472. Amounts were not recalculated in these:

- WO-385 — client invoice variance text is Freight or Price/qty change. Vendor invoice number stays in the notes.
- WO-392 — draft variance titles are the charge type, not the product name and not a bare invoice number.
- WO-383 / WO-384 — freight label, bury hides a charge from the working list.

PO line cost stays the order. Bill total is separate. That part is WO-387.
