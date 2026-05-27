# CCH Studio — Data Cleanup History & Re-Import Guard

**Last updated:** May 27, 2026
**Maintainer:** Cynthia Holloway
**Purpose:** (1) Catalog every cleanup pass that has touched production data, so the work isn't accidentally re-done or undone. (2) Lock in re-import rules so Houzz Project Tracker re-imports don't bring back the bad data that was cleaned up.

This is a living document. Every cleanup pass appends a row. Every re-import script must read the "Re-Import Guard Rules" section before running.

---

## ⚠️ ROOT CAUSE — READ BEFORE TOUCHING IMPORT CODE

**The Houzz Project Trackers (new-Houzz era exports) are the source of the bad data.** Specifically they contain:

- **Wrong categories** — e.g., "Lighting Billing" instead of "Lighting"; "Pillows" without proper category mapping; mixed-case room names ("LIGHTING", "FLORALS") used as category values
- **Missing categories** — many rows have no category at all, which the import previously treated as taxable-product-default
- **Time Billing / Design Services lumped with products** — service lines came in without `expenseType: 'service'` set, so they were treated as taxable products
- **Rooms in the category field** — Houzz uses board names like "Kitchen", "TV", "Inventory", "S7 Bunk Bed" as if they were product categories
- **All-caps room boards** ("LIGHTING", "FLORALS") accidentally surface as categories

**Every cleanup row below corresponds to fixing one of these problems on data that was already in production.**

If a Houzz Project Tracker re-import overwrites the cleaned fields, the same bugs return. The Re-Import Guard Rules below enforce that.

---

## RE-IMPORT GUARD RULES (apply to ALL Houzz import scripts)

Before any Houzz Project Tracker import script writes a doc, check:

| Field about to write | Skip write if doc has | Why |
|---|---|---|
| `category` | `_categoryFixedAt` is set | Apr 29 Phase 1.5/1.6 cleaned 4,064 categories. Re-import would re-pollute. |
| `category` | `category` already set AND `source` is `cch-studio-clipper`, `clipper`, `manual`, or `ideabook-asset` | Protected sources |
| `expenseType` | `expenseType` is `'service'` or `'expense'` | Tax audit set these explicitly; import must not strip |
| `taxable` | `_taxableFixedAt` is set (added by tax audit) | Tax audit cleaned these |
| `imageUrl` | `imageUrl` is Firebase Storage URL (contains `firebasestorage.googleapis.com` or `houzz-products/`) | Houzz catalog URLs are stale/Ivy; never overwrite Firebase URLs |
| `room` | `room` already set on doc | Room assignment was hand-curated |
| Any field on doc with `_imageLocked: true` | always | Manual override flag |

**General rule:** Houzz imports run in **fill-empty-only mode**. They populate empty/missing fields. They do NOT overwrite existing values. The Apr 29 Phase 1 work documented this and 5,283 products were enriched safely under this rule.

---

## Cleanup History

### April 28-29, 2026 — Foundational Houzz Catalog Enrichment + Category Cleanup

**Authority:** Cynthia / Claude Code session
**Session log:** `Cursor_Handoff_Apr29.md` (in `Claude - CCH studio/Cursor & Code Index, logs, Audits, Note & HANDOFFS/`)

| Phase | Scope | Docs touched | Manifest | What it did |
|---|---|---|---|---|
| Phase 1 | Production `products/` | **5,283** | `_debug/phase1-prod-execute-manifest.csv` | Filled empty fields from Apr 27 Houzz catalog (`houzzId`, `vendorUrl`, `dimensions`, `materials`, `finish`, `manufacturer`, `description`). Refreshed 4,855 `imageUrl`s. **Fill-empty-only — never overwrote.** Added `_enrichedFromHouzzApr27` marker. |
| Phase 1.5 | Production `products/` | **3,838** | `_debug/phase1_5-prod-execute-manifest.csv` | Category cleanup. 2,368 rooms moved from `category` → `room` field. 1,470 typos normalized to Clipper whitelist. Added `_categoryFixedAt` marker. |
| Phase 1.6 | Production `products/` | **226** | `_debug/phase1_6-prod-execute-manifest.csv` | ALL-CAPS room boards (LIGHTING, FLORALS) → `room`. TV → `room`. S7 Bunk Bed → `room`. Lowercase "mirror" → "Mirror". Added `_categoryFixedAt`. |
| Phase 1.5/1.6 staging mirror | Staging `products/` | 3,402 + 224 | `_debug/phase1_5-staging-execute-manifest.csv`, `_debug/phase1_6-staging-execute-manifest.csv` | Mirrored prod cleanup to staging |
| Phase 1.5 dry-runs | (read-only) | n/a | `_debug/phase1_5-rooms-to-fix.csv`, `_debug/phase1_5-typos-to-normalize.csv`, `_debug/phase1_5-cant-map-leave-alone.csv`, `_debug/phase1_5-unknown-leave-alone-manifest.csv`, `_debug/phase1_5-remove-from-library.csv` | Pre-execution review CSVs |

**Markers in production data (use to detect already-cleaned docs):**
- `_enrichedFromHouzzApr27` — Phase 1 touched it (5,283 docs)
- `_categoryFixedAt` — Phase 1.5 or 1.6 touched it (4,054 docs)

**Source whitelist used (Clipper MASTER_PRODUCT_CATEGORIES + CCH extended):**
Art · Mirror · Accessories · Fabric & Trim · Furniture · Stone & Tile · Appliances & Plumbing · Hardware · Floor Covering · Florals · Wall · Bedding & Pillows · Wall Covering · Custom Furniture · Custom Upholstery · Cabinets · Custom Bedding and Pillows · Custom Window Coverings · Windows · Lighting · Architectural · Mirrors & Accessories (CCH extended — 1,036 products use it)

> **⚠️ The Clipper whitelist is no longer canonical for CCH category cleanup.** Per the May 27 cleanup of `STUDIO_PRODUCTS_IMPORT BAD REPORT BAD CATEGORIES.csv`, Cynthia confirmed a richer CCH-specific taxonomy that supersedes the Clipper list. See **"CCH Canonical Category Taxonomy (May 27)"** section below for the authoritative list.

**These are ROOMS, not categories** (per Cynthia, baked into Phase 1.5/1.6 logic):
- Inventory, Bar, TV, S7 Bunk Bed
- Proper names: Damon, Kelly, Calvin, Emi, Tracey, Ron, Garza Blanca
- Anything ALL CAPS that matches a real category lowercased = Houzz room board name

---

### May 27, 2026 — CCH Canonical Category Taxonomy (authoritative)

**Context:** Cleaned `STUDIO_PRODUCTS_IMPORT BAD REPORT BAD CATEGORIES.csv` (1,194 rows → 1,181 after Cynthia's edits). During cleanup, Cynthia clarified that the Clipper whitelist alone is insufficient — CCH uses a more granular taxonomy.

**File produced:** `Houzz & QB/Houzz Reports/New Houzz reports/STUDIO_PRODUCTS_IMPORT_CLEANED_v4_FINAL_May27.csv`

**CCH Canonical Product Categories (May 27, 2026 — supersedes Clipper whitelist):**

| Category | Notes |
|---|---|
| Lighting | |
| Mirrors & Accessories | Distinct from `Accessories` — used when mirror is part of the SKU |
| Accessories | Standalone accessories (no mirror component) |
| Furniture & Upholstery | **Canonical** — covers ALL furniture including dining chairs, dining tables, upholstered pieces. Custom upholstery products go here, NOT under "Custom Upholstery". |
| Fabric & Trim | Includes trim. NOT "Fabric + Trim" or "Fabric" alone. |
| Hardware | General hardware |
| Window Hardware | Window-specific hardware (drapery rods, finials) — distinct from general Hardware |
| Bedding & Pillows | Off-the-shelf bedding/pillow products |
| Custom Pillows & Bedding | Custom-made pillows + bedding (CCH terminology — NOT "Custom Bedding and Pillows" from Clipper) |
| Custom Window Treatments | Custom drapery, shades (CCH terminology — NOT "Custom Window Coverings" from Clipper) |
| Windows | Window products (not coverings) |
| Wall | Wall products |
| Wall Covering | Wallpaper, panels |
| Appliances & Plumbing | Includes refrigerators, ranges, dishwashers, sinks, faucets |
| Floor Covering | Hard floor coverings |
| Rugs | Separate from Floor Covering |
| Stone & Tile | Includes grout, solid surface, countertops |
| Cabinets | Includes cabinet doors and components |
| Florals | |
| Art | |
| Architectural | |

**Expense / Service categories (NOT product categories — these set `expenseType` and `taxable: false`):**

| Category | expenseType | taxable | Notes |
|---|---|---|---|
| Freight | `freight` | No | Shipping/delivery fees |
| Labor | `service` | No | Labor lines (install, reupholster, tailor, fabrication) |
| Expense | `expense` | No | Generic expense passthrough |
| Prepaid Tax | `expense` | No | Tax prepayments |
| Custom Upholstery | `service` | No | **Labor-only.** If a row says "Custom Upholstery" but is a PRODUCT (no labor keyword), remap to `Furniture & Upholstery` per Cynthia May 27. |

**Keyword detection (apply at import-time on title + description + vendor + sku):**
- `\bfreight\b` (case-insensitive) → `Freight` category, `expenseType: freight`, `taxable: No`
- `\blabor\b` / `\binstall\b` / `\breupholster\b` / `\btailor\b` / `\bfabricat\b` → `Labor` category, `expenseType: service`, `taxable: No`

**Category remap rules applied to bad inbound data:**

| Houzz-tracker value | Canonical value |
|---|---|
| `Fabric  + Trim`, `Fabric + Trim`, `Fabric` | `Fabric & Trim` |
| `Window` | `Windows` |
| `Pillows` | `Bedding & Pillows` |
| `Appliances  & Plumbing` (double space) | `Appliances & Plumbing` |
| `Cabinet Hardware` | `Hardware` |
| `Cabinet Door Style` | `Cabinets` |
| `Solid Surface`, `Grout` | `Stone & Tile` |
| `Dining Chairs`, `Dining Table` | `Furniture & Upholstery` |
| `Dishwasher`, `Refrigerator`, `Range` | `Appliances & Plumbing` |
| `Custom Window Coverings` (Clipper) | `Custom Window Treatments` (CCH canonical) |
| `Custom Bedding and Pillows` (Clipper) | `Custom Pillows & Bedding` (CCH canonical) |
| `Mirror` (Clipper) | `Mirrors & Accessories` (CCH canonical, where appropriate) |
| `Furniture` (Clipper) | `Furniture & Upholstery` (CCH canonical) |
| `Furniture & Upholstery` | unchanged ✓ |
| `Custom Upholstery` on product item | `Furniture & Upholstery` (CCH canonical) |
| `Custom Upholstery` on labor item (has labor keyword) | unchanged — flag as service line |

**Categories needing manual review (no auto-mapping):**
- `Uncategorized` — review per item
- `Wood Stain` — possibly maps to `Cabinets` or new `Paint` category (not yet in whitelist)
- `Paint` — not in whitelist; consider adding or mapping to `Wall Covering`
- `Outdoor` — too vague; needs item-level review

**Whitespace rules (enforced on every category write):**
- Trim leading + trailing whitespace
- Collapse multiple internal spaces to one (`Fabric  + Trim` → `Fabric + Trim` → then remap to `Fabric & Trim`)
- Excel-roundtrip CAN reintroduce trailing whitespace — always re-trim on import

**Markers to add on cleanup writes (per Re-Import Guard Rules at top of this file):**
- `_categoryFixedAt: <timestamp>` — Phase 1.5/1.6 marker, still in use
- `_taxonomyV: "2026-05-27"` — new — marks docs cleaned to this canonical list

---

### May 13, 2026 — Client Portal Inspiration Restoration

**Session log:** `Docs/SESSION_LOG_Claude_2026-05-13.md`

Not a data cleanup — code restoration after the Apr 20 portal regression. Mentioned here so the May 13 entry doesn't get conflated with category cleanup work.

---

### May 19, 2026 — Houzz Design-Service Tax Audit

**Trigger:** IN-12929 open balance — design services were being incorrectly taxed on Houzz imports.

**Root cause:** Houzz import Pass 3 created service lines without `expenseType` / `taxable` set. Missing `expenseType` was treated as taxable-product when the invoice had a `taxRate`.

**Session log:** `Docs/SESSION_LOG_Cursor_2026-05-19.md` §4

| File | What it did |
|---|---|
| `_debug/fix-design-service-invoice-tax.js` | Script to recompute taxable flag for Houzz design-service lines |
| `_debug/fix-design-service-invoice-tax-apply-1779558644951.json` | Apply log — run 1 |
| `_debug/fix-design-service-invoice-tax-apply-1779561534170.json` | Apply log — run 2 |
| `_debug/fix-design-service-invoice-tax-apply-1779562650815.json` | Apply log — run 3 |
| `_debug/export-tax-docs-last-2y.js` | Tax export helper |
| `platform/index.html` | `cchInvoiceLineIsTaxable()` — runtime taxable check |
| `platform/index.html` | `normalizeInvoiceLineItemsForEdit()` — sets `expenseType` correctly on load |
| `platform/index.html` | Houzz import `_houzzImportMapInvoiceLine()` — sets `expenseType` on insert |
| `platform/index.html` | Console tools: `auditDesignServiceInvoiceTax()`, `fixDesignServiceInvoiceTax()` |

**Markers added:** lines now carry explicit `expenseType: 'service' | 'expense' | 'product'` instead of relying on missing field = taxable-product default.

---

### May 22, 2026 — Invoice Edit/View Split + Tax Rules Module

**Session log:** `Docs/SESSION_LOG_Cursor_2026-05-22.md`

| File | What it did |
|---|---|
| `platform/cch-invoice-tax-rules.js` (new) | Centralized invoice tax rule helpers |
| `platform/index.html` | Edit view = line items only. View page = totals/payments/QB/client sidebar. No Unit column on invoices. **"Shipping" = freight fee** (now consistent label). |
| `_debug/fix-in12946-totals.js` + `fix-in12946-totals-apply-1779558640181.json` | IN-12946 total restoration |
| `_debug/fix-in12958-totals.js` + `fix-in12958-totals-apply-1779561531301.json` | IN-12958 total restoration |
| `_debug/restore-in12946.js` + `restore-in12946-apply-1779557748233.json` | IN-12946 doc restoration |

Verified live on production: IN-12946.

---

### May 22-24, 2026 — Image URL Rewrites (Ivy → Firebase)

Not a category/tax cleanup, but a major data cleanup pass on imageUrls. Listed here for completeness.

| File | What it did |
|---|---|
| `scripts/rewrite-image-urls.js` | Rewrites `ivy-uploads.s3...amazonaws.com` URLs to `houzz-products/<houzzId>/...` Firebase Storage URLs |
| `_debug/rewrite-image-urls-apply-1779553746655.json` | Apply log — first run |
| `_debug/rewrite-image-urls-apply-1779584763589.json` | Apply log — second run |
| `scripts/sync-image-urls-across-docs.js` (new) | Cross-doc image URL sync |
| `_debug/sync-image-urls-apply-1779555823932.json` | Apply log |
| `_debug/sync-image-urls-apply-1779557669704.json` | Apply log |
| `_debug/sync-image-urls-apply-1779568417741.json` | Apply log |

**Status:** ongoing — 6,810 Ivy URLs still need rewriting before May 25 deadline (per `CURRENT_PRIORITIES.md` URGENT #1).

---

### Document Dedup (selected boards)

| Board | When | Manifest | What it did |
|---|---|---|---|
| Cloud-Rolling-Hills | (per Cursor analysis) | `_debug/phase8-doc-dedup-manifest.csv` | Picked richest doc per invoice number, deleted empty shells. 0 dupes today. |
| Cloud-Susan | (per Cursor analysis) | `_debug/fix-susan-restore-clean.js` | Cleaned. 0 dupes today. |
| Cloud-Huntington-Beach | Pending | — | **26 dupe clusters as of May 27. Not cleaned.** |
| Cloud-Parker | Pending | — | **110 dupe clusters. Not cleaned.** |
| Cloud-Mustang | Pending | — | **43 dupe clusters. Not cleaned.** |
| park-city | Pending | — | **82 dupe clusters.** |
| shimano-westridge-lane | Pending | — | **60 dupe clusters.** |
| katke-graceland-dr | Pending | — | **41 dupe clusters.** |
| greene-de-anza | Pending | — | 30 dupe clusters |
| day-2590-monaco-drive | Pending | — | 27 dupe clusters |
| bradbury-high-drive | Pending | — | 26 dupe clusters |
| ~20 other boards | Pending | — | Smaller counts |
| **Firm-wide total** | — | — | **592 extra duplicate invoice docs** |

Dedup helper scripts:
- `_debug/fix-dup-merge-lines.js` — merge lines from sibling docs before deletion
- `_debug/fix-hb-dedupe-payments.js` — payments-aware dedup
- Grok's draft `fix-duplicates-lines.js` — Cynthia handed off to Cursor May 24

---

### Catalog Phases 2-11 (image upload + clip enrichment + cross-doc backfill)

Run between Apr 29 and May 14 — the bulk catalog work after Phase 1.

| Phase | Manifest | What it did |
|---|---|---|
| Phase 2A | `phase2a-upload-manifest.csv`, `phase2a-extended-manifest.csv` | Initial image upload to Firebase Storage |
| Phase 2B | `phase2b-repoint-manifest.csv` | Repointed `imageUrl` fields to Firebase paths |
| Phase 4A | `phase4a-upload-manifest.csv` | Image upload (additional batch) |
| Phase 4B | `phase4b-manifest.csv` | Repoint (additional batch) |
| Phase 5 | `phase5-expense-candidates.csv`, `phase5-deleted.csv` | **Expense candidates identified** — partial deletion. See note below. |
| Phase 6 | `phase6-po-coverage-manifest.csv`, `phase6c-backfill-manifest.csv` | PO coverage + backfill |
| Phase 7 | `phase7-rh-cleanup-manifest.csv` | Rolling Hills cleanup |
| Phase 7B | `phase7b-category-backfill-manifest.csv` | Category backfill |
| Phase 7C | `phase7c-clip-houzzid-image-manifest.csv` | Clip houzzId/image cross-reference |
| Phase 8 | `phase8-doc-dedup-manifest.csv` | RH document dedup |
| Phase 9B | `phase9b-create-manifest.csv` | Document creation |
| Phase 9C | `phase9c-enrich-manifest.csv` | Document enrichment |
| Phase 10 | `phase10-inv-prop-backfill-manifest.csv`, `phase10-inv-prop-backfill-manifest.PRE-1.3.csv` | Invoice/proposal backfill |
| Phase 11 | `phase11-writer-manifest.csv`, `phase11-audit-rh-selections.csv` | Final writer pass + RH selections audit |
| Phase A v2 | `phase-A-v2-detail.csv` | Detail report |

---

## Cleanups NOT yet done (still pending — see `CURRENT_PRIORITIES.md`)

| Item | Where flagged |
|---|---|
| Remove 11 service/expense rows from Product Library | `phase1_5-remove-from-library.csv` (Apr 29) — never executed |
| Fix "Appliances  & Plumbing" double-space typo (14 docs) | CURRENT_PRIORITIES.md MEDIUM #8 |
| Connect product image slots 2-5 via `images[]` array | 9,579 orphans in `houzz-products/<houzzId>/{2..5}.<ext>` |
| Document dedup on 25+ remaining boards | This file ↑ (592 firm-wide extras) |
| Tearsheets page (currently blank) | CURRENT_PRIORITIES.md MEDIUM #9 |
| Triple-DUP cleanup on Cloud-Rolling-Hills clips (~1,043) | CURRENT_PRIORITIES.md NICE-TO-HAVE #12 |
| **Time Billing** standalone cleanup | Never done — relies on Phase 1.5 normalization |
| **Freight** standalone cleanup | Never done — labeling fixed May 22 but no data pass |

---

## Per-Invoice / Per-Doc Targeted Fixes (audit trail)

These are one-off fixes for specific documents. Not bulk passes.

| File | Target |
|---|---|
| `_debug/fix-12946.js` | IN-12946 |
| `_debug/fix-in10170.js`, `fix-in10170-prod.js`, `fix-in10170-image.js` | IN-10170 |
| `_debug/fix-in10171-prod.js` | IN-10171 |
| `_debug/fix-in11988-line-amount.js` | IN-11988 line amount |
| `_debug/fix-rh-invoice-tags.js` | Rolling Hills invoice tags |
| `_debug/fix-whitesail-images.js`, `fix-whitesail-inv.js` | Whitesail images + invoice |
| `_debug/fix-staging-vendor-url.js` | Staging vendor URL fix |
| `_debug/mustang-vendor-fix-manifest.csv` | Mustang vendor name fix |
| `_debug/in12902-writer-manifest.csv`, `in12980-line-match-manifest.csv`, `in12980-writer-manifest.csv` | IN-12902 / IN-12980 line+writer work |

---

## How to add to this file

After any cleanup pass (production write):

1. Add a row under the correct section above with: date, phase name, scope, doc count, manifest file path, brief description.
2. If new markers were added to docs (like `_enrichedFromHouzzApr27`), add them to the "Markers" sub-list AND to the **Re-Import Guard Rules** table.
3. If the pass cleaned a NEW class of data (e.g., a freight pass), add a new top-level section.
4. Bump `Last updated:` at the top.
5. Commit to git (`backup:` prefix).

---

## How to use this file when writing a new import script

Before writing any Houzz Project Tracker import:

1. Read the **Re-Import Guard Rules** table above.
2. For every field your script writes, check the corresponding "Skip write if" condition.
3. Run a dry-run first that COUNTS how many docs would be overwritten — if any cleaned doc would be overwritten, STOP and reconcile.
4. Add your phase to the Cleanup History section after a successful run.

**Default to fill-empty-only.** Overwriting is the source of the regression problems.
