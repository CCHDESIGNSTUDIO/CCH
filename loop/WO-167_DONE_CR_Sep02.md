# WO-167 DONE — Builder: no restore-draft prompt after save

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo167-draft-prompt** (not a Studio `CCH_BUILD` bump)

## Symptom (Cindy)

Vanessa: after she saves a work order and goes to another work order (or works on something else), Chrome shows `cch-platform.web.app says` — “This browser has an unsaved draft from 9/2/2026, 12:01:26 PM. Restore the unsaved draft? (Cancel keeps the saved copy.)” Screenshot: GRE-W-10 / Greene-Hixson roller, URL `workOrderId=ztMI7Qn9oyTyXp9E2Coz`.

## Surfaces

| Surface | This WO |
|---------|---------|
| Custom Order Builder (`platform/builder/index.html`) | **Yes** — local draft autosave + restore prompt |
| Studio proposals / invoices / POs / print | **No** |

## Grounding (this turn)

- Prompt text: `platform/builder/index.html` `maybeRestoreBuilderLocalDraft` (now ~6083).
- Native `confirm()` was at former :6087 (removed).
- Save already called `clearBuilderLocalDraftAfterSave` at :6373 (now still after Firestore set).
- Switching WOs always flushed a new local draft: `loadWorkOrderById` :6502 (`writeBuilderLocalDraftNow` when `prevId !== nextId`).
- Autosave debounce 2200ms: `scheduleBuilderDraftSave` :5995 — save did not cancel the timer.

## Root cause

After a successful project Save, Builder still treated leftover `localStorage` drafts as unsaved work:

1. Switching work orders always wrote a browser draft of the WO being left, even when nothing had changed since Save.
2. A pending 2.2s autosave timer could rewrite the draft after `clearBuilderLocalDraftAfterSave`.
3. Opening a saved WO always `confirm()`’d if any draft existed for that key — including a copy of the just-saved project data.

The Chrome “says” box is that native `confirm()`, not a failed save.

## Change

- Track `builderDirtySinceSave`. Autosave / flush only write a draft when there are edits since the last project Save.
- On Save: cancel the draft timer, clear both draft keys, stamp `cch_builder_last_project_save_v1_*`.
- On WO switch with no dirty edits: delete leftover draft for the WO being left (do not rewrite it).
- On restore: if draft timestamp is not newer than last project Save or Firestore `updatedAt`, drop the draft with no prompt.
- Real unsaved drafts still prompt, via styled `cchConfirm` (Restore draft / Keep saved copy) — no native `confirm()`.

## Self-test

- Grep: no `confirm(` in `platform/builder/index.html`.
- File tail intact (`</html>` at :12180).
- All four `maybeRestoreBuilderLocalDraft` call sites `await`.
- Live browser: **not yet** — needs staging hosting. Vanessa’s existing leftover drafts will discard on first open if they are older than the Firestore save.

## Verify (after staging)

1. Ctrl+Shift+R on `https://cch-platform-staging.web.app/builder/`
2. Header subtitle build tag **2026-09-02wo167-draft-prompt**
3. Open a saved WO → Save work order → pick a different Existing Work Order — **no** restore dialog
4. Open the first WO again — **no** restore dialog
5. Edit a field, do **not** Save, switch to another WO, switch back — styled “Unsaved draft” modal should appear (not a Chrome `says` box)
