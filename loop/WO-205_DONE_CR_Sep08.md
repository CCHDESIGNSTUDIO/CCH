# WO-205 DONE — PO/invoice Edit: Edit image must replace the line photo

**Change ID:** 9.9.325  
**Date:** 2026-09-08  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 8 Cloud – Rolling Hills **PO-9054** (Walker Zanger, 3/4 Slab Calacatta Gold Extr): **Edit image** under the thumb did nothing. Same wrong photo on the invoice. She has said before not to lock her out of editing line photos.

## Diagnosis (file:line)

- `docEditRenderItems` `platform/index.html` ~40880: **Edit image** / **Edit images** was a `.doc-edit-img-hint` **div with no onclick**. CSS ~3008: 9px gray, no pointer. Clicking the caption did nothing.
- Hidden file input sits next to it (`onchange="uploadDocEditImage"`). `docEditTriggerImageUpload` ~45271 clicks that input — used only from the ⋮ **Upload image** menu, not from the hint.
- Thumbnail `onclick="docEditOpenLineEditor"` (~40833) does open the line modal. Upload there still works.
- `editDocLineItem` ~36543: if the line has a `clipId` and `_imageManual !== true`, the editor **merged Room Board clip photos** onto the line. Invoice + PO are snapshots; that overlay is the lock she hits when she opens the photo editor.

`_imageLocked` / `lineItemImageIsProtected` block **Apply from Library**, not a file upload. `uploadDocEditImage` ~37819 already writes the new URL and sets `_imageManual` on POs.

## Surfaces

| Intended | Must not |
|----------|----------|
| PO Edit + invoice Edit line photo replace | Per-line Vendor on PO |
| **Edit image** click → file picker → persist on that document | Write back to Product Library or clips |
| | Auto-copy PO photo onto the linked invoice (isolation — separate snapshots) |
| | Print/PDF restyle, Bill To / Ship To |

Asymmetric gate (reported): clip-photo overlay in the line editor now runs for **`collection === 'proposals'` only**. Invoices and POs keep the document snapshot.

## Change

- Hint is a button: `docEditTriggerImageUpload(idx)`. Underline + pointer so it reads as a control.
- PO/invoice line editor no longer overlays clip images.
- After a PO upload, toast notes the invoice is a separate snapshot.
- Studio **9.9.325** `edit-image-hint-2026-09-08`.

## Self-test

- Grep: `doc-edit-img-hint` now a `<button>` with `docEditTriggerImageUpload`.
- `editDocLineItem` clip overlay gated to proposals.
- File tail: `</html>` intact. No satellite JS change (no `node --check`).

## Verify after staging

Hard refresh. Sidebar **9.9.325**.

1. PO-9054 Edit: click **Edit image** under the slab → file picker → new photo sticks after refresh.
2. Same line on the **invoice** Edit: click **Edit images** and replace (PO save does not change the invoice).
3. Spot-check one proposal Edit: clip overlay still loads extra Room Board photos when the line is clip-sourced and not `_imageManual`.
