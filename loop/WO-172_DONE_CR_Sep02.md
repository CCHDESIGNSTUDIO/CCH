# WO-172 DONE — Builder: saved WO never asks restore-draft

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo172-save-is-save**

## Symptom (Cindy)

“Why doesn’t it just save — why do we need messages — it used to just SAVE WHEN SAVED. DON’T CONFUSE US.” Vanessa still saw Unsaved draft after Save (GRE-W-01).

## Surfaces

| Surface | This WO |
|---------|---------|
| Opening a **saved** work order | **Yes** — no restore modal; keep project copy |
| Brand-new unsaved WO (no id yet) | Unchanged — silent browser restore only |
| Studio / print | **No** |

## Grounding

- Prompt lived in `maybeRestoreBuilderLocalDraft` `platform/builder/index.html` (~6130). Added so a silent restore would not wipe Firestore with an emptier local draft.
- After Save, preview paint still wrote a leftover local draft (WO-170). Opening the WO then asked a question Cindy never wanted.

## Root cause

Save already wrote the project. The modal asked whether to overlay a browser backup. That question is the confusion.

## Change

If the work order already has an id (it is saved on the project): throw away the browser draft and use the saved copy. No modal. No Restore / Keep saved copy.

## Verify (after deploy)

1. Hard refresh Builder — header **2026-09-02wo172-save-is-save**
2. Save a WO → open another → open the first again — **no popup**
3. New unsaved WO still recovers typed-but-not-saved work in this browser (no modal)
