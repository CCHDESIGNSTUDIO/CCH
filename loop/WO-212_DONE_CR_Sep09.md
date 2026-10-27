# WO-212 DONE — PO Preview: no DRAFT badge; stop crunched top

**Change ID:** 9.9.333  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9 PO-9054 Preview: layout packed at the top of the letter; **DRAFT** badge under PO number.

## Diagnosis (file:line)

- **DRAFT:** `cch-proposals-invoices-fix.js` ~5902 printed `.doc-status` for every document. On POs it used `cchPoShippingStatus(...) || docData.status || 'Draft'`. Shipping status is empty until confirmed; new POs are created with `status: 'Draft'` (`index.html` ~45928). That internal status was painted on the vendor PDF.
- **Crunch:** PO screen CSS (`body.cch-po-vendor-print .page` ~5808) set `min-height:0; display:block` and `doc-footer { margin-top:12px }`, which cancelled the shared `margin-top:auto` footer. Print paddings were 8–12px (WO-209 inset pass).

## Surfaces

| Intended | Must not |
|----------|----------|
| PO Preview / Print only | Invoice, proposal, tear sheet |
| Hide status badge on PO | Restyle Bill To / Ship To type or stack |
| More padding + footer at bottom of the preview window | Restore 100vh print stretch (WO-159 extra page) |

Print `@page` left inset stays even L/R (0.5in), not the old 0.8in proposal left.

## Change

- No `.doc-status` HTML on `type === 'po'`.
- Screen: flex column + `min-height: calc(100vh - 52px)` so footer sits at the bottom of the Preview window.
- Print: larger section padding; footer `margin-top:28px`. No print `min-height:100vh`.

Studio **9.9.333** `po-preview-no-draft-space-2026-09-09`. `cch-proposals-invoices-fix.js?v=20260909po212`.

## Self-test

- `node --check platform/cch-proposals-invoices-fix.js` passed.
- Grep: PO Preview has no `doc-status` when `type === 'po'`.

## Verify after staging

Hard refresh. Sidebar **9.9.333**.

1. PO-9054 Preview — no DRAFT box. Header / Bill To / table / footer have air; footer at the bottom of the Preview window.
2. Print/PDF: same, one page for this one-line PO (no extra blank page).
3. One sent invoice Preview: status badge still there.
4. One sent proposal Preview: Draft/Published badge unchanged.
