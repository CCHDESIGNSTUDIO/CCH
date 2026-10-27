# WO-170 DONE — Builder: Save must not rewrite local draft

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo170-save-no-redraft**

## Symptom (Cindy)

Vanessa still got “Unsaved draft” after Save (GRE-W-01, 3:45 PM). Styled modal = WO-167 is live. Chrome `says` box is gone. Cindy: “Why is this even coming up if she saved the work order.”

## Surfaces

| Surface | This WO |
|---------|---------|
| Custom Order Builder Save → local draft | **Yes** |
| Studio / print | **No** |

## Grounding (this turn)

- `updatePreview()` `platform/builder/index.html:9829` called `scheduleBuilderDraftSave()` on **every** preview paint.
- `renderForm()` ends with `updatePreview()` at `:12045`.
- `saveWorkOrder` cleared the draft, then called `renderForm()` (`:6438`), which re-marked dirty and scheduled a new draft ~2.2s later.
- Idle banner “Saved to project — safe to refresh after Save” is the default for any opened saved WO (`updateHeaderSaveUI`), not proof of a just-clicked Save.

## Root cause

Save wrote the work order to the project, then rebuilt the form. Rebuilding the preview is treated as a new edit, so the browser stored a fresh “unsaved” draft **after** Save. Opening another WO (or this one again) then asked to restore that leftover.

## Change

Call `clearBuilderLocalDraftAfterSave()` again **after** `renderForm()` in `saveWorkOrder` (cancel timer, dirty=false, remove draft keys, restamp last Save).

## Self-test

- Grep: second `clearBuilderLocalDraftAfterSave` immediately after `renderForm()` in `saveWorkOrder`.
- File tail intact.
- Live: **not yet** — needs hosting.

## Verify (after deploy)

1. Hard refresh Builder — header **2026-09-02wo170-save-no-redraft**
2. On GRE-W-01 this time: click **Keep saved copy** if the old modal is still up (clears leftover)
3. Save → pick another Existing Work Order → **no** Unsaved draft modal
4. Type something, do not Save, switch WO, switch back — modal **should** still appear
