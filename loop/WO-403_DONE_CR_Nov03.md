# WO-403 DONE — client invoice simple or itemized

Time invoices keep the short letter (Simple) and can switch to the line-table invoice (Itemized). Studio 9.9.480. Not click-tested in the browser.

## Client display

`platform/cch-invoice-redesign.js` toolbar and the print window: Simple, Itemized, Show notes, Show date, Show hours, Show rate.

- Simple is the numbered letter. Show hours puts the hours on the right. Show notes shows the line text. The client portal does not show these switches.
- Itemized is the regular invoice table. Qty is the hours. The per-line “Service period” line is gone. “4.0 hours — design services” is gone. Show notes stays.
- The choice is saved on the invoice as `clientInvoiceLayout`. Until that is set, the client still gets Simple.

## AI notes

Itemized print shows `clientSummary` and saved outcome text instead of the raw dated bullets when a summary exists. Saving an invoice no longer rewrites that summary into one row per time entry (`platform/index.html` docEditSave). Draft with AI keeps a shorter grouped list.

## Files

- `platform/cch-invoice-redesign.js`
- `platform/cch-proposals-invoices-fix.js` (invoice branch of the shared preview)
- `platform/index.html` cache busters and build 9.9.480
- `platform/client.html` cache busters

Purchase orders, proposals, and tear sheets were not given these switches. No commit.
