# WO-188 DONE — PO Preview letter-width on screen

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-03  
**Asked by:** Cindy — PO-9052 Preview/PDF window looked tiny (full-bleed `about:blank`).

## Surfaces

- **Intended:** PO Preview **screen** only (`body.cch-po-vendor-print .page`).
- **Must not change:** `@media print` / `@page` (letter still fills the printed page). Proposal Preview, invoice Preview, tear sheets.

## Grounding

- Shared screen column: `.page { max-width:850px }` at `cch-proposals-invoices-fix.js:5654` (proposal/invoice).
- PO override had stretched it: `body.cch-po-vendor-print .page { max-width:100%; margin:0 }` at `:5781`.
- Print already: `.page{max-width:none!important;width:100%!important}` at `:5801` plus PO `@page { size:letter; margin:0.5in }` at `:5804`.

## Change

PO Preview `.page` is 850px centered again. Light gray window chrome so the sheet reads as a page. Print CSS untouched.

## Files

- `platform/cch-proposals-invoices-fix.js` ~5778–5781 (`?v=20260903po2`)
- `platform/index.html` `CCH_BUILD` 9.9.319; script cache buster

## Self-test

- `node --check platform\cch-proposals-invoices-fix.js` — pass
- File tail intact
- Grep: print `@media` still `max-width:none`; PO screen now `max-width:850px`

## Verify (staging, after #1 deploys)

Hard refresh. Sidebar **v9.9.319**. Open PDF on:

1. One PO (e.g. PO-9052) — Preview is a centered letter column; Print / PDF still letter.
2. One sent invoice Preview
3. One sent proposal Preview
4. One tear sheet (from proposal/invoice Include Tear Sheets)

Your Rolling Hills screenshot is still **v9.9.317** — this is not live until staging deploy. WO-187 (Vendor before Document tags) ships in the same batch.
