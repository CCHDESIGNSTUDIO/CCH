# WO-177 DONE — Clear detail image actually saves

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** shipped in same file as **2026-09-02wo178-wo-list-rev**

## Symptom

Cindy GRE-W-10: Clear Dual shade / old detail did not stick after Save. Image came back.

## Grounding

- `clearImageSlot` / `clearPickerSlot` dropped keys from `swatchUrls` and `pickerSelections`.
- `saveWorkOrder` uses `docRef.set(payload, { merge:true })`. Firestore merge **keeps nested map keys that are omitted**.

## Change

- Cleared slots write `""` locally.
- Save writes `FieldValue.delete()` for empty/missing `swatchUrls`, `pickerSelections`, captions, slot titles (`builderMergeDeleteEmptyKeys`).

## Verify

Clear Dual shade style → Save → hard refresh → still No image.
