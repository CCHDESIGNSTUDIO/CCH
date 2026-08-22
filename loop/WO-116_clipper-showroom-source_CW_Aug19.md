# WO-116 · Clipper: capture showroom/source separately from vendor — v1.0 · CW Aug 19

**Change ID:** FT-048 · **Executor:** Cursor · **Verifier:** Claude · **Attempt:** 1 of 3
**Lane:** Studio platform + Clipper · **Deploy target:** staging (production needs Cindy's typed GO)

## The problem (Cindy, Aug 19)

> *"I need to choose on the Clipper between the manufacturer and the source/showroom supplier. Emtek is the vendor/manufacturer. MyKnobs or Hardware Hut is the showroom/supplier we purchase from."*

**Terminology, per Cindy — binding:** *vendor* and *manufacturer* are **the same thing**. There are exactly two roles:

| Role | Field | Example |
|---|---|---|
| **Vendor** (= manufacturer, who makes it) | `vendor` | Emtek, Carpe Diem, Schlage, Ashley Norton |
| **Showroom / source** (who we buy and get billed from) | showroom field, below | MyKnobs, Hardware Hut |

Today the Clipper writes **one** value into `vendor`. When she clips from a showroom site, the showroom lands in `vendor` and **the maker is lost**.

## Grounded mechanism

**The model already exists on the PO/billing side and must be reused, not reinvented:**

- `platform/cch-po-bill-variance.js:2091` — *"AP payee on vendor bill — showroom when they invoice direct; else PO manufacturer."*
- `platform/cch-po-bill-variance.js:2223` — UI copy: *"…manufacturer when the vendor bills you. Pick a **showroom** when they invoice direct."*
- Field: **`billFromVendor`** — set at `2123`, `2733`, `5758`; cleared at `5761`
- Picker: `cchPoBillFromPickerHtml(poVendorName, billFromVendor)` — `5574`
- Vendor-type classifier: `3432`–`3455` — already detects `showroom` / `to the trade` in a vendor's type and returns `'Showroom'`; option list built at `3504`–`3512`

**Evidence of the loss** (`_scripts/vendor-vs-manufacturer_BY_CLAUDE_2026-08-19.js`, 19,886 production documents):

| Measure | Count |
|---|---|
| documents with a `vendor` | 17,226 |
| documents with a `manufacturer` | 1,724 |
| have both, values genuinely differ | 1,041 |
| **`vendor` is a showroom** (MyKnobs / Hardware Hut / build.com / Wayfair / Perigold / Ferguson) | **141** |
| …of those, **no maker recorded anywhere** | **95** |

Examples — maker lost entirely:
- `products` · "Carpe Diem Charlemagne 4" c.c. Fleur De Lys" — `vendor: "Hardware Hut"`, manufacturer empty, sku `CDH-599-`
- `products` · "Schlage Siena Keyed Entry Door Knob Set" — `vendor: "Hardware Hut"`, manufacturer empty
- Rolling Hills clip · library slug `..._flush_pull_in_french_antique_brass_by_emtek__myknobs__hardware__` — slug carries **both** Emtek and MyKnobs, but `vendor` stored only `MyKnobs`

## What to build

### A. Clipper capture — two fields, not one

On clip, capture and store both:
- `vendor` — the **maker**. Emtek.
- **`showroomVendor`** — the source/supplier. MyKnobs.

Name it `showroomVendor` and mirror `billFromVendor` semantics exactly (same trim, same empty-means-absent, same delete-when-cleared behaviour as `cch-po-bill-variance.js:5761`). Do **not** introduce a third term or reuse `manufacturer` — per Cindy, vendor *is* manufacturer.

### B. Picker in the clip/product edit UI

Reuse the existing showroom classification (`cch-po-bill-variance.js:3432`–`3455`) and option-list builder (`3504`–`3512`) so the showroom dropdown lists the same vendors flagged `Showroom` / `to the trade` that the PO Bill-from picker already offers. One source of truth for what counts as a showroom.

### C. Carry through to the PO

When a clip with a `showroomVendor` becomes a PO line, `showroomVendor` pre-fills **`billFromVendor`** on the vendor bill. That is the whole point: she is billed by the showroom, not the maker.

## HARD RULES

1. **Vendor = manufacturer.** No new "manufacturer" concept in the UI. The existing `manufacturer` field (1,724 docs, 1,041 disagreeing with `vendor`) is legacy — **read it if present, never write it** in this order.
2. **No backfill, no data migration, no Firestore rewrite** of the 141 mis-stored documents. Cleanup is a follow-up WO once capture is correct.
3. **`showroomVendor` is optional.** A clip taken straight from the maker's own site has no showroom. Empty must stay empty, never defaulted to the vendor.
4. **RESOLVE vs APPLY** (CLAUDE.md Rule 3) — adding a showroom must not trigger any auto-persist onto existing doc lines.
5. **No layout changes** to PO/invoice/proposal screens (CLAUDE.md Rule 4). The showroom picker goes in the clip/product edit surface only.
6. Do **not** alter `billFromVendor` behaviour on the PO side. This order feeds it; it does not change it.
7. Ground before editing per `CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md`. Counts above are a lead, not evidence.
8. Staging only. Never commit, push, or deploy from the shared working copy.

## Acceptance (binary)

1. Clipping from myknobs.com stores `vendor: "Emtek"` and `showroomVendor: "MyKnobs"` — two distinct values on one clip.
2. Clipping from a maker's own site stores the maker in `vendor` and leaves `showroomVendor` **absent** (not empty string, not a copy of vendor).
3. The clip/product edit screen shows both fields, each independently editable.
4. The showroom dropdown lists exactly the vendors the PO Bill-from picker lists — same classifier, verified against one known Showroom-typed vendor.
5. Converting such a clip to a PO line pre-fills `billFromVendor` from `showroomVendor`.
6. Existing clips with no `showroomVendor` render and save unchanged — no console error, no field invented on save.
7. No existing document is rewritten by loading or viewing it (RESOLVE, not APPLY).
8. `manufacturer` is never written by any path in this order.

## Verify (Claude, staging)

- Clip a Carpe Diem item from Hardware Hut → confirm `vendor: "Carpe Diem"`, `showroomVendor: "Hardware Hut"`.
- Clip an Ashley Norton item from Ashley Norton direct → confirm `showroomVendor` absent.
- Open an existing Rolling Hills clip (no showroom) → renders clean, saves without adding the field.
- Convert one clip to a PO line → `billFromVendor` pre-filled.
- Console clean on `index.html` and `client.html`.
- Evidence into `loop/verify/`.

## Rollback

Code-only revert. This order writes no migration, so no data cleanup on rollback. New `showroomVendor` values written during testing are additive and harmless.

## Follow-up WOs (do not do here)

- **Backfill the 141 mis-stored documents** — move showroom out of `vendor` into `showroomVendor` and restore the maker. Needs a dry-run manifest and Cindy's typed GO.
- **Retire the legacy `manufacturer` field** — 1,724 documents, 1,041 disagreeing with `vendor`. Decide keep-or-merge with Cindy first.
