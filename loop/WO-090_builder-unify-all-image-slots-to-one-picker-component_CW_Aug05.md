# WO-090 · Builder — EVERY image-add slot uses the SAME picker component + the one unified library modal · CW Aug 05
**Lane:** Builder · **File:** `platform/builder/index.html` · **Executor:** Cursor (handed off from Code) · **Verifier:** Fable · **Gate:** Cindy GO for prod. Staging first, minimal diff on the 5MB file.

## What Cindy wants (exact)
Every place you can add an image in the Builder must look and behave **identically** — the same button row the **REFERENCE IMAGE** slot already has:
> **BROWSE LIBRARY · THIS COMPUTER · PROJECT LIBRARY · CLEAR**
…and BROWSE LIBRARY opens the **one unified picker** with a clean **dropdown-to-select** (Select from: source → folder/board → click image). No more mismatched pickers, no ad-hoc upload widgets, no one-off "Browse X library" buttons.

## Current state (what Code left on staging `ft062-one-picker`)
- **The unified picker already exists and is the source of truth: `openImageLibraryPicker(opts)`** — Storage-folder browsing (any `/library/*` folder + subfolders) **and** a Style Library boards toggle, applies via `opts.onPick(item)`. `openLibraryFolderModal` (the REFERENCE/Furniture picker) and `openTrimOptionLibraryModal` (trim) already delegate to it, so the **modal is unified**. Reuse it — do not build another.
- **What's still inconsistent = the SLOT UI, not the modal.** The REFERENCE/Furniture slots render via **`buildPickerDetailSlot(cat, pickerConfig)`** (the good 4-button row, stores in `state.pickers[cat][pickerId]`). The **detail slots** (Nailheads `nailheadRef`, Stitch `stitchDetail`, Finish `woodFinishRef`, Feet `feetRef`) still render via `buildImageUploadWithCaption(...)` + a lone "Browse … library" button, and store in `d.swatchUrls[key]`. **That data-model difference is why they can't just reuse `buildPickerDetailSlot`.**

## The change
Make the detail slots (and any remaining trim/upload slots) render the **same 4-button row** as `buildPickerDetailSlot`, opening `openImageLibraryPicker`. Two clean ways — Cursor's call:
- **A (recommended):** turn the detail slots into real pickers (give them `pickerConfig` entries + `state.pickers` storage), so they use `buildPickerDetailSlot` verbatim and inherit everything (4 buttons + unified modal). Then update the print/render (`collectProductHeroDetailImageCols`, WO-076-B placement) + `saveWorkOrder` to read the picker value instead of `swatchUrls[key]`. Backward-compat: still read legacy `swatchUrls[key]` if a picker value isn't set.
- **B (smaller):** build a `buildImageSlotRow(cat, {label, swatchKey, detailKey, libraryCategory})` helper that renders the identical 4-button row but writes to `swatchUrls[swatchKey]`: BROWSE LIBRARY → `openImageLibraryPicker` (onPick sets swatchUrls); THIS COMPUTER → `queueDetailImageFromComputer`; PROJECT LIBRARY → the products picker applied to the swatch slot; CLEAR → clear the swatch. Use it for Nailheads/Stitch/Finish/Feet in place of `buildImageUploadWithCaption`.

## Guardrails
1. **One picker component + one modal everywhere.** No parallel pickers. Reuse `openImageLibraryPicker` and match `buildPickerDetailSlot`'s button row exactly.
2. Don't break WO-076-B finish placement, WO-077-B page 2, the letter-fit print, or existing saved WOs (legacy `swatchUrls` values must still render).
3. Finish stays: `d.detailSelections.finish` = text source of truth; a library pick fills the finish IMAGE (`woodFinishRef`) only (Code already fixed the "[object Object]" from setting the text field to an object).
4. Minimal diff; if it balloons, ship the slots that convert cleanly and flag the rest.

## Acceptance (Fable, staging screenshots)
1. Nailheads / Stitch / Finish / Feet each show the **same** BROWSE LIBRARY · THIS COMPUTER · PROJECT LIBRARY · CLEAR row as REFERENCE IMAGE.
2. BROWSE LIBRARY on any of them opens the identical unified picker (Select from: Storage folder / Style Library boards → folder/board dropdown → image).
3. A picked image renders on the tear sheet (WO-076-B placement) and prints; older WOs still open. No console errors.

## Note for Cindy / environments
Staging has **0 Style Library boards**; prod has **8** — so the Style Library source is empty on staging by design, full on prod. Storage folders exist in both.
