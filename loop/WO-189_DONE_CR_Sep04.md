# WO-189 DONE — Invoice/proposal Print: gift thumbs + line specs

**Change ID:** 9.9.320  
**Date:** 2026-09-04  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging queue; print layer — no same-session production GO)

Cindy Sep 4 INV-6068 Chrome Print: thumbs shrinking; Essentials (towel warmer) had no dimensions. Tear sheets already showed DIMENSIONS `20" w x 25" H`. She asked if the earlier fix was stuck.

## Surfaces

| Surface | This WO |
|---------|---------|
| Invoice Print/PDF (`previewDocument`) | **Yes** — 80px contain thumbs + SKU/finish/dimensions when filled |
| Proposal Print/PDF | **Yes** — same shared CSS + specs helper |
| Invoice / proposal Client View line block | **Yes** — specs under title |
| PO Print thumbs | **Must not** — `body.cch-po-vendor-print` stays 104px |
| Bill To / Ship To | **Must not** — untouched |
| Standalone tear sheets (`generateTearSheetsFromDoc`) | Dim aliases only (`_tearMetaFromInvoiceItem`); layout unchanged |

## Asymmetric gate (the stuck fix)

WO-159–162 / 186 put specs and larger thumbs on **PO Print only**. Invoice/proposal still had:

- `cchPoLineSpecsBlockHtml` only when `type === 'po'` (`cch-proposals-invoices-fix.js` ~3368 and ~5295)
- Shared `@media print` smash: `.cch-premium-item-thumb img` **48×48** (~5801). PO overrode back to 104px; invoice/proposal inherited 48px.

Tear sheets already read `item.dimensions`. Invoice Print showed Description only. Essentials has dims on the snapshot, empty marketing description → blank under the name.

## Files

- `platform/cch-proposals-invoices-fix.js` ~3368–3378 (`_docViewLineRowsHtml`): invoice/proposal product lines call `cchPoLineSpecsBlockHtml(..., { includeDescription: false, omitRoom: true, omitTag: true })`; keep Description block.
- Same file ~5299–5307 (`_premiumAppendLineRow`): same for Preview/Print.
- Same file ~5734–5737 screen thumbs 72/64 → **88/80 contain**.
- Same file ~5811 shared `@media print` thumbs 56/48 → **88/80 contain**. PO print override ~5828 unchanged (104px).
- `platform/index.html` ~4370 `CCH_BUILD` **9.9.320**; ~89577 cache buster `?v=20260904inv1`; `_tearMetaFromInvoiceItem` ~16329–16336 dim aliases + `cchPoSplitPrintDescription` fill-empty.
- `platform/client.html` ~12405 cache buster match.

## Self-test

- `node --check platform\cch-proposals-invoices-fix.js` — pass.
- File tails intact (`})();` / `</html>`).
- Grep: no remaining `type === 'po' && typeof window.cchPoLineSpecsBlockHtml`.
- Shared print 48px smash gone; PO 104px override still present.

## Verify after staging deploy (four-document)

1. Hard refresh. Sidebar **9.9.320**.
2. **INV-6068** Print/PDF: Essentials shows **Dimensions** (`20" w x 25" H` if on the line); thumbs ~80px contain, not postage stamps. Radiance description still present.
3. One **sent proposal** Print — thumbs + specs when filled.
4. One **PO** Print — thumbs still 104px; specs unchanged.
5. One **tear sheet** from invoice — DIMENSIONS still prints (aliases only).

Does not invent depth if it is not on the invoice snapshot. Isolation: no library write-back.
