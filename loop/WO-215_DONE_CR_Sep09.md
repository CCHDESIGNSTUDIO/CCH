# WO-215 DONE — Restore landscape tear sheets 3A / 3B

**Change ID:** 9.9.336  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9: Rolling Hills cobble tear sheets (Bleu Chinois / Antique Bluestone) used the parked **classic** engine — 132px portrait thumb column, `object-fit: contain`, dead white bands. The Aug 13 filmstrip layouts were better.

## Diagnosis (file:line)

- `_tearResolveLayoutId` (`index.html` ~16295) returned `'classic'` for every export (Aug 13 park so Time Agent could ship). Modal radios for Filmstrip (3A) / Full-bleed (3B) were ignored.
- `_tearSheetPageHtml3A` / `3B` had been **stripped** (0 hits). `_tearSheetPageHtml` (~16663) always rendered gallery + right text column.
- Classic CSS `.ts-gallery--multi{grid-template-columns:1fr 132px}` + `object-fit:contain` produced the postcard-in-white look.

Spec rebuilt from `_debug/tear_sheet_layout_options_BY_CURSOR_2026-08-13/design_handoff_tear_sheets/` (README + `Tear Sheet Layouts.dc.html` 3A/3B blocks).

## Surfaces

| Intended | Must not |
|----------|----------|
| Generate Tear Sheets window (proposal / invoice / clip / ideabook) | Proposal, invoice, PO Print/PDF Bill To / Ship To / line items |
| Default **3A** filmstrip; optional **3B** | Portrait 1A–2A (not this pass) |
| RFQ Request Pricing (`rfqMode`) stays **classic** so SKU still prints | Change invoiced proposal math, PO print |

Invoice Preview **Include Tear Sheets** (`cch-proposals-invoices-fix.js` ~5864) is a separate leftover engine — not touched.

## Change

- Un-park `_tearResolveLayoutId`: `auto`/`3a` → `3a`; `3b` → `3b`; `rfqMode` → `classic`.
- New `_tearSheetPageHtml3A` / `_tearSheetPageHtml3B` / `_tearSheetCoverImg` with pinned px heights and `object-fit:cover`.
- `_tearSheetPageHtml` dispatches on layout id.
- 3A/3B CSS (Jost + Cormorant, cool neutrals). `.ts-head-cat` added (was in HTML, missing in classic CSS).
- `CCH_BUILD` **9.9.336**.

3A/3B spec rail is Dimensions / Application / Room / Investment. Modal toggles for Description / SKU / internal notes do not print on 3A/3B (design sheet has no slots). RFQ stays classic.

## Self-test

- Grep: `_tearResolveLayoutId` no longer hard-returns classic; `_tearSheetPageHtml3A` / `3B` present.
- Dispatch: `_tearSheetPageHtml` calls 3A/3B before classic fallback.
- RFQ: `opts.rfqMode` → classic.
- No edits to `@media print` on proposal/invoice/PO document print (only tear-sheet window CSS).

## Verify (after staging)

Hard refresh. Sidebar **9.9.336**.

1. PRO-3038 Generate Tear Sheets, Filmstrip (3A): hero fills left (~594px), four landscape tiles 300×139, specs **under** photos, no 132px portrait sliver.
2. Same doc, Full-bleed (3B) on a 5-photo line: text rail left, images bleed.
3. One invoice Print and one PO Print unchanged.
4. Request Pricing RFQ sheet still shows SKU (classic).
