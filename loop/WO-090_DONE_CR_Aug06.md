# WO-090 DONE — Unify Builder image slot rows · CR Aug 06

**Approach:** Option B — same 4-button chrome as Furniture (`Browse library · This computer · Project library · Clear`), still write the correct persistence field (`renderingUrl` / `detailSketchUrl` / `sectionViewUrl` / `swatchUrls` / trim `imageUrl`). Unified modal: `openImageLibraryPicker`.

## Grounding
- Target look: `buildPickerDetailSlot`
- Missed in first pass: `buildImageUploadWithCaption` still wrapped `buildUpload` (click-to-upload box) — used for windows main/detail, bedding/pillows fabrication, custom box, custom4
- Also missed: pillows `detail`, shadeVendor, Vendor material swatches, hardware labels, spec attach bar, More detail trim modal, treatment layer modal

## Changes (`platform/builder/index.html`)
1. Helpers: `imageSlotLibraryCategory`, `getImageSlotSrc`, `applyImageSlotUrl`, `clearImageSlot`
2. `buildImageSlotRow` — 4 buttons always (incl. Project library); supports `slotTitleKey` + all image key types
3. `buildImageUploadWithCaption` → thin wrapper around `buildImageSlotRow` (windows / bedding / pillows / roller details)
4. Wired shadeVendor, pillows box detail, Vendor swatch rows to `buildImageSlotRow`
5. Spec attach + hardware + trim More-detail + treatment layer → same button labels
6. Build stamp: `2026-08-06ft065-wo090-everywhere` (Studio **9.9.105**)

## Guardrails kept
- Finish text = `detailSelections.finish` string only
- Legacy `swatchUrls` / rendering URLs still read for print
- Syntax: `node --check` on extracted inline scripts — OK
- `buildUpload` left in file (unused by form slots) — no behavioral callers remain

## Verify (staging)
1. **Windows** → Rendering & reference: Main rendering + section/detail slots show 4 buttons (not dashed upload box)
2. **Bedding / Pillows** → Main image, Fabrication drawing, Custom box, Additional detail, Box/construction — same 4 buttons
3. **Upholstery** → Nailheads: A/B notes **plus** Nailhead style reference row with 4 buttons
4. Materials Vendor swatch + shade face material — same 4 buttons
5. Hard refresh until Builder meta shows `ft065-wo090-everywhere`
