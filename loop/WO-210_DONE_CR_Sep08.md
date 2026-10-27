# WO-210 DONE — PO Edit image must persist

**Change ID:** 9.9.331  
**Date:** 2026-09-08  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 8: imaging is not saving on the PO; she needs to send POs.

## Diagnosis (file:line, this turn)

- `uploadDocEditImage` `platform/index.html` ~37879: after a successful upload it called `docEditAutoSave()` (1.5s debounce). Preview already flushes save (`cch-proposals-invoices-fix.js` ~4887), but clicking the **thumbnail** cancelled the pending save (`docEditOpenLineEditor` ~40691) and opened the line editor from Firestore.
- `editDocLineItem` ~36571: if Firestore had a **larger** `images[]` gallery than memory, it copied the old gallery over the new single photo. After `cchEnforcePoLineSingleImage` memory has 1 image; clip-sourced PO lines still have N photos on the document. That merge is the revert.
- `uploadDocEditImage` skipped files whose `file.type` was empty (iPhone/HEIC) with no toast. Modal path already used `_piFileIsUploadableImage` (~37033).
- `cchPickPreferredProductImageUrl` ~64462: when `libraryProductId` is set, library photo wins over the line `imageUrl` unless `imageUrlOverride` / `_imageManual`.

## Surfaces

| Intended | Must not |
|----------|----------|
| PO Edit **Edit image** → file sticks on that PO after refresh / Preview / Print | Write back to Product Library or clips |
| | Change invoice snapshot (isolation) |
| | Per-line Vendor on PO Edit |
| | Print restyle / Bill To / Ship To |

Asymmetric gate: Firestore gallery overlay in the line editor now skipped for **`purchaseOrders`** and for `_imageManual`. Proposals still merge a larger Firestore gallery.

## Change

- Upload writes Firestore **immediately** (`await docEditSave()`), not 1.5s later.
- Opening the line editor **flushes save** instead of cancelling it.
- PO / `_imageManual` lines do not get the old Firestore gallery copied back.
- `_piFileIsUploadableImage` + 8 MB + toast if nothing added.
- `cchEnforcePoLineSingleImage` wipes leftover thumbnail/gallery fields; sets `imageUrlOverride` when `_imageManual`.
- `cchPickPreferredProductImageUrl` returns the line photo when `_imageManual` / `_poSingleImage`.

Studio **9.9.331** `po-edit-image-persist-2026-09-08`.

## Self-test

- Grep: `await docEditSave()` in `uploadDocEditImage`; `_fsImgN > _memImgN && item._imageManual !== true && collection !== 'purchaseOrders'`.
- File tail: `</html>` intact. No satellite JS change.

## Verify after staging

Hard refresh. Sidebar **9.9.331**.

1. PO Edit: **Edit image** under the thumb → pick a JPG → toast **PO photo saved**.
2. Preview / Print immediately — new photo, not the old slab.
3. Refresh the PO — photo still there.
4. Invoice for the same line is unchanged (replace there separately if needed).
