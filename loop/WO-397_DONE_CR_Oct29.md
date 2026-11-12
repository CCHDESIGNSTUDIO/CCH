# WO-397 DONE — variance description boxes stay

Cindy Oct 29. INV-6086 description boxes had been cleared to the word Freight or Expense. She asked to put the notes back and stop that from happening again.

## What changed

- `platform/cch-po-bill-variance.js` — `cchPoCleanClientInvoiceLines` (about 9334) returns immediately, so it does not write descriptions. `cchPoReshapeDraftVarianceInvoiceLines` (about 9379) returns the lines unchanged, so opening the invoice does not save Freight or Expense over the description. `cchPoResolveVariance` (about 8677) no longer writes one lump line.
- `platform/cch-proposals-invoices-fix.js` — the variance description box (about 3494–3509) shows the stored description. Client print still strips purchase-order wording. Clicking out of the box saves what is in the box.
- `platform/index.html` — Studio 9.9.477, tag variance-each-charge. Script cache `20261029wo397`.

## INV-6086 data

Production invoice `boards/cloud-rolling-hills/invoices/pftDOyPOdztvpeqn6KBP`. Status Unsent. No QuickBooks id. Description only was written, and only where it was exactly Freight or Expense and a note was still stored. Amounts, titles, tax, categories, and line notes were not changed. The $800 Concretti freight description is `Concretti Sinks`. The $95.95 Arteriors freight and the $442.55 Artistic Tile freight had no stored note, so those stay Freight.

## Self-test

`node --check` passed on `cch-po-bill-variance.js`, `cch-proposals-invoices-fix.js`, and `cch-project-subpanel.js`. Live `https://cch-platform.web.app` serves build 9.9.477 and the two early returns. After the write, a re-read showed the descriptions above. The invoice was not opened in the browser.

## Not done

The purchase-order variance rebuild was not written. Dry-run list remains `loop/WO-397_DRYRUN_variance-lines_Oct29.md`.

Production hosting 2026-10-29 14:53. No commit. No Cloud Functions deploy.
