# E-Spec Book Builder — Briefing v2.0 (visual page + linked PDFs, Reece/eSpec model)

**MH_Aug11_v2.0** · Lane: **Cursor** · Home: **Spec Book tab** (`#/project/{id}/specbook`) · **Staging first; prod on Cindy GO.**
**Supersedes** `ESPEC_BOOK_BUILDER_BRIEFING_MH_Apr03`. Target layout: `Docs/SPEC_BOOK_TARGET_REFERENCE_REECE_GRID.png`.
**Reference:** Reece Bath & Kitchen e-SpecBook (Specbooks.com), card anatomy + download modal (Cindy screenshots, Aug 11).

> **Grounding note.** Code line refs are to `platform/index.html` unless noted, read Aug 11. Claims about the *current completeness* of `renderSpecBookTab` are marked 💩 and must be confirmed before scoping build effort.

---

## 1. What changed from v1 (Apr 03), and why

v1 specced a 4-step builder whose Step 2 was **manually attaching documents to each item** (drag-and-drop per row). That step is unnecessary, and here is why, grounded in the live code:

- The spec sheet already lives on the **product**, as a saved URL (`specUrl` / `specLink`, read by `_clipSpecUrlFromDoc` @11439; set via the product modal's "Product spec URL" field @21898).
- Invoice and proposal **line items already link to that product** via `clipId` / `sourceClipId` (@8827, @9431, @9515), and the clip links to the library product via `libraryProductId` (@11615).

So the book is a **correlation, not an attach flow**: select items, follow each to its product, pull the doc link the product already holds. Nothing gets re-attached.

The new model (from the Reece / Specbooks reference Cindy provided): the book is a **branded visual page of item cards** (image + specs) with the spec sheet **linked, not stored**. Reece links the manufacturer's Specification and Installation PDFs as downloads; it does not warehouse them. We do the same with `specUrl`.

**Consequence:** capturing/storing vendor PDFs is now an **optional durability upgrade** (section 8), not a prerequisite. v1's blocker is removed.

---

## 2. The model: two artifacts off one dataset

### A. Live web book (hosted, shareable)
- **Grouped by room/area**, collapsible sections with counts. Sourced from an **invoice** (primary), or FFE, or a room.
- **Per-item card:** product image (with enlarge control), **manufacturer** (vendor), **product name**, **MODEL #** (SKU), **QTY**, and a **"Technical Documents"** row of linked docs (Specification, Installation, ...). Optional per-item **comment**.
- **CCH-branded header** (firm mark, project name, date).
- **Shareable** via the existing external-view mechanism (token route → `client.html`, no Studio login), and reachable from the project **Files** folder.

### B. Downloadable PDF (configurable) — mirrors Reece's "Download e-SpecBook" modal
- Options: **images per page (1 / 2 / 4 / 6)**; **display level** (Images only / with names / with names & descriptions); toggles for **Model #s, Quantities, Comments, Specifications & Info, Installation**; plus CCH **Cover page / Table of Contents / Room dividers / Pricing summary**.
- **Pricing summary is staff-only, off by default, and never rendered on a shared/contractor/client book** (section 6).
- Rendered through the existing tear-sheet engine (`_tearSheetPageHtml` / `_getTearSheetCSSRedesign`) laid out **N-up** per the Reece-grid target.

---

## 3. Data mapping — what already exists

| Reece card element | CCH field / function (exists today) |
|---|---|
| Product image | clip / product image |
| Manufacturer | item `vendor` |
| Product name | item `title` |
| MODEL # | `sku` |
| QTY | line `qty` |
| "Specification" link | `specUrl` / `specLink` (`_clipSpecUrlFromDoc` @11439; product modal @21898) |
| Item → product link | `clipId` / `sourceClipId` (@8827/9431/9515) → `libraryProductId` (@11615) |
| Group by room | room tags / Room Boards / FFE (`renderFFETab` @17189) |
| Branded header | `_tearSheetHeaderHtml` |
| Download layout options | `showTearSheetOptionsDialog` (field + pricing toggles) |
| Live shareable page | external-view pattern (`client.html`, token route; `#/clientview/*`) |
| Save to document folder | `boards/{projectId}/files` (`renderFilesTab` @17603, `uploadProjectFiles`) |
| Home tab | Spec Book tab (`renderSpecBookTab` @17190) 💩 confirm current completeness |

Nearly the entire feature already exists. The net-new work is the three deltas below.

---

## 4. The three deltas (the only net-new work)

**Delta 1 — More than one doc link per product.** Reece shows **Specification AND Installation**. We store one `specUrl`. Add a small typed list on the product/clip:
```
productDocs: [ { type: 'spec' | 'installation' | 'warranty' | 'other', label, url } ]
```
Edit it in the product modal (extend the existing "Product spec URL" field into a small repeater). The card's Technical Documents row renders these links. **Back-compat:** migrate any existing `specUrl` into `productDocs[{type:'spec'}]`; never drop `specUrl`.

**Delta 2 — N-up grid layout.** Extend the tear-sheet render to a grid page (1/2/4/6 per page) per `SPEC_BOOK_TARGET_REFERENCE_REECE_GRID.png`, reusing `_tearSheetPageHtml` cells.

**Delta 3 — Live shareable book page + source picker.** Assemble the grouped card page from a chosen source (invoice / FFE / room), render it in the Spec Book tab, expose it via the external-view token route, and land the export in `boards/{projectId}/files`.

---

## 5. Source = the invoice (plus FFE / room)

- **Primary entry:** on an invoice, a **"Create Spec Book"** action over its line items. Resolve each line via `clipId` → product → `productDocs`.
- Also launchable from **FFE** (the canonical product list) and from a **Room**.
- **Items with no doc link** render the card with a flagged **"No spec on file"** state (v1's missing-docs / gold-border idea). Coverage is a product-library data task, not a book bug. Run the coverage check in section 9 before promising a full book.

---

## 6. Money / visibility rules (non-negotiable)

- **No client sell price, markup, or margin** on any contractor-facing or client-facing book. Honors `CCH_STANDING_RULE_client-visibility-boundary` and the contractor money-free rule.
- **Pricing summary** in the download modal is **staff-only, off by default, never on a shared book.**
- The live book is the **same surface the contractor-access feature grants**, and the per-item comment is the **contractor collaboration layer**. This is a tie-in, not a second build: the E-Spec Book is the document a contractor opens, downloads the cut sheet from, and comments on.

---

## 7. PDF engine decision (the open fork from v1, now decided)

- **Live book** = an HTML page, no PDF engine needed.
- **PDF download** = render the tear-sheet HTML to PDF via a **Cloud Function (headless Chrome)**, save to Storage, link in `boards/{id}/files`. Print-quality, handles the multi-page N-up book, matches brand exactly, and Cloud Functions already run in this stack.
- Client-side `html2pdf` is the quick fallback but rougher on cross-origin images, fonts, and page breaks.
- **Recommendation: Cloud Function.** (Fall back to client-side only if Cindy wants a throwaway v1.)

---

## 8. Optional durability (later, NOT v1)

Links can rot and need internet. A later "capture" step future-proofs the book:
- `productDocs` URL is already a **PDF** → download + store on the product (offline, permanent).
- URL is an **HTML page** → generate a CCH tear sheet from product data as the stored page (don't scrape).
- One-time per product, at the product/FFE level. Not required for v1; the book links out exactly like Reece until then.

---

## 9. Do before building

1. 💩 **Read `renderSpecBookTab` (@17190)** and report whether it's a stub or a partial builder. The tab exists; the Apr checklist was empty; something shipped in between.
2. **Spot-check `clipId` on a real invoice's lines** (does the product link survive onto invoice items, or only proposals).
3. **Spec-URL coverage:** across active projects, what percent of invoiced items have a doc link today. This number decides whether the book is 90% there or mostly empty.

---

## 10. Migration & safety

- Additive fields only (`productDocs[]`); migrate `specUrl` in place, never drop it.
- No change to how invoices/proposals compute money.
- Nothing already sent to a client is altered.
- Staging first; prod on Cindy GO.

---

## 11. Acceptance (binary)

1. From an invoice, **"Create Spec Book"** produces a grouped, CCH-branded page of item cards (image, manufacturer, name, model #, qty, doc links); items with no doc are flagged.
2. Cards link to the product's saved doc URLs, and **multiple doc types render** (Specification + Installation).
3. The **Download modal** produces a PDF at the chosen N-up and detail level, with **no client-forbidden money** on a shared book.
4. The book **saves into `boards/{projectId}/files`** and is **shareable via a token link** (external-view), no Studio login.
5. Verified on staging, then prod on Cindy GO.

---

## 12. Sources / grounding

- Reference: **Reece Bath & Kitchen e-SpecBook** (Specbooks.com), card + download modal (Cindy screenshots, Aug 11).
- Code (`platform/index.html`): `_tearSheetPageHtml`, `_getTearSheetCSSRedesign`, `_clipSpecUrlFromDoc` @11439, product spec URL @21898, `clipId` @8827/9431/9515, `libraryProductId` @11615, `renderFFETab` @17189, `renderFilesTab` @17603, `renderSpecBookTab` @17190; `boards/{id}/files`.
- Supersedes `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Apr03.md`. Target: `Docs/SPEC_BOOK_TARGET_REFERENCE_REECE_GRID.png`.

*v2.0, Aug 11 2026. Draft for Cursor ingest. Internal-code claims marked 💩 require verification against `C:\dev\CCH-Platform-Deploy\cch-deploy` before build.*
