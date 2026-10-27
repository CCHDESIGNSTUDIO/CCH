# WO-176 DONE — Material Note on WO; drop Shade face from Specs

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** `cch-builder-rev` **2026-09-02wo176-mat-note**

## Symptom

1. Cindy GRE-W-10: Openness went away in the material merge — type it as a **Note** (`5% open`). Form had the unlabeled swatch textarea; MATERIALS preview did not print it.
2. **Shade face: Vendor · Material # solar · Black** still printed under Specs. Material already lives in MATERIALS (Lutron / Color).

## Surfaces

| Surface | This WO |
|---------|---------|
| Builder roller/window WO preview Specs | **Yes** — remove leftover Shade face line |
| Builder MATERIALS preview | **Yes** — print Note |
| Form vendor swatch | **Yes** — label **Note** |
| Studio print (proposal / invoice / PO / tear sheet) | **No** |

## Grounding

- Specs inject: `platform/builder/index.html` was `:9715` `isShadeRollCategory` + `shadeVendorMaterialHasContent` → **Shade face:** from leftover `shadeVendorMaterial` (part # / color), not from Material A.
- Swatch note store: `imageCaptions["swatch_A"]` via `buildImageSlotRow` `:7344`.
- MATERIALS row: `buildPreviewFabricRow` `:4142` printed Color + vendor disclaimer, not the caption.

## Change

- Removed the Shade face spec row. Material stays in MATERIALS only.
- Preview MATERIALS: **Note:** from swatch caption (`fabricSwatchNote`).
- Form: **Note** label; placeholder `e.g. 5% open — prints in Materials`.
- If old Shade Face openness/note exists and swatch note is empty, copy into the note.

## Verify (after deploy)

1. Header **2026-09-02wo176-mat-note** (Ctrl+Shift+R).
2. GRE-W-10: Specs has no **Shade face** line. MATERIALS still has Lutron / Color.
3. Note `5% open` under swatch prints as **Note:** in MATERIALS. Save if it was only typed.
