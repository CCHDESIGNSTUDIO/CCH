# WO-263 DONE — Order Builder vendor estimate import no longer crashes

Cindy Oct 1, staging Order Builder: Import Workroom Estimate threw `Cannot read properties of undefined (reading 'trim')` in `extractBartoloPoMeta`.

## Grounding

- `extractBartoloPoMeta` in `platform/builder/index.html` ~2851.
- A quote with no `Vendor:` / `From:` / `Supplier:` line took `"".split(/\s{2,}|$/)` which returns `[]`. `[0].trim()` then threw.
- Console on staging: `importBartoloEstimatePdf` → `extractBartoloPoMeta`.

## Change

- Vendor and project text are read only when the match has a capture. The `$` split is gone.
- An estimate or quote that has a Description / Qty table is read with the same line parser as an invoice.

## Self-test

- The old expression throws on `ESTIMATE` + `DESCRIPTION QTY AMOUNT`. The new one returns empty vendor and does not throw.
