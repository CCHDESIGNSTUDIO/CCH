# WO-344 DONE — one invoice line per time entry

Cindy Oct 24. INV-6085 showed five service totals. She said twenty-eight lines were missing. `createTimeInvoice` had grouped every selected time entry by service into one line.

## Files

- `platform/index.html`
  - `cchTimeEntryInvoiceLine` — one line: title includes the date, category is the service name (T&E, not T&E VH), qty is that entry's hours, amount is that entry's total, `timeEntryId` is set.
  - `createTimeInvoice` — no longer groups by service. Each entry is a line. Notes still follow the note picker.
  - `cchExpandDraftTimeInvoiceItems` — a Draft time invoice whose `timeEntryIds` are longer than its item list is split when the invoice opens. The new total must match the old line total within five cents or the invoice is left grouped. Sent, paid, and QuickBooks invoices are not rewritten.
  - Called from `renderInvoiceDetail` right after the invoice document loads.

## Self-test

Read the load site and the create path. No `node --check` on `index.html`. Expansion writes Firestore only in the browser, only for Draft, only when the money matches.

## Not done

Did not open INV-6085. The split runs the next time that draft is opened on a build that includes this change.
