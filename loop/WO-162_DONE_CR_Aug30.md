# WO-162 DONE — PO Print: EXIF landscape thumbs (not skinny vertical)

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-08-30  
**Build:** Studio **9.9.305** `?v=20260830poprint6`

## Symptom (Cindy)

PO-9045 Chrome Print: slab thumbs still **skinny vertical slivers**. Preview looks unlike the Studio PO page. Cannot test this PO on staging (prod Firestore only).

## Surfaces

| Surface | This WO |
|---------|---------|
| PO Print / PDF popup + Chrome print | **Yes** (`body.cch-po-vendor-print`) |
| Invoice / proposal / tear-sheet print | **No** — generic 48×48 print thumbs unchanged |
| Studio PO Client View | No |

## Grounding (this turn)

- Screen CSS: `cch-proposals-invoices-fix.js:5787–5789`
- Print override: `:5814–5816` (must beat generic `@media print` 48×48 at `:5799`)
- Preview window: `previewDocument` at `:4858` opens a blank tab, writes print HTML + navy toolbar. `@media print` hides the toolbar (`:5799`). Chrome Print is a second layout pass — not a screenshot of Client View.
- WO-161 set `image-orientation:none` + `height:80px`. Phone/camera JPEGs store landscape slabs as portrait buffers + EXIF rotate. `none` showed the raw portrait buffer inside a squeezed ITEM column → thin vertical strips.

## Change

1. Restore `image-orientation:from-image` so Chrome honors EXIF (same as the Studio UI).
2. `height:auto; max-height:70px` instead of forced `height:80px`.
3. Grid/thumb slightly narrower (110px / 104px img) so ITEM is not crushed.

## Files

- `platform/cch-proposals-invoices-fix.js` `:5787–5789`, `:5814–5816`
- `platform/index.html` `CCH_BUILD` 9.9.305; cache buster `?v=20260830poprint6`
- `platform/client.html` cache buster

## Verify

**PO-9045 is production data.** Staging cannot reproduce it. After Cindy GO + production deploy: close the old Print tab, Ctrl+Shift+R, sidebar **v9.9.305**, Print / PDF → Chrome Print. Slabs should read landscape (wide, not slivers). Check Headers/footers off. Background graphics does not rotate photos.

Also smoke one staging PO print so invoice/proposal thumbs stay 48px.

**PRODUCTION hosted 2026-08-30 ~16:58** (Cindy GO). Staging same. Close the old Print tab. Ctrl+Shift+R. Sidebar **v9.9.305**.
