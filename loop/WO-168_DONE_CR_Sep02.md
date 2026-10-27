# WO-168 DONE — Builder: Specs notes always; spec images in Details only

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo173-builder-full** (same file as WO-169–173)

## Symptom (Cindy)

GRE-W-05: notes on Design Specs should print under **Specs** even with no photo. Spec photos must not sit beside spec text — they belong with the other detail images under the rendering. Clearing a photo must not wipe the note.

## Surfaces

| Surface | This WO |
|---------|---------|
| Custom Order Builder preview / print (`platform/builder/index.html`) Specs + detail band | **Yes** |
| Studio proposals / invoices / POs / tear sheets | **No** |

## Grounding (this turn)

- Specs loop `platform/builder/index.html:9627–9641` previously required spec text *or* a thumb (`pp-spec-thumb`) and never printed `specAttachmentNotes`.
- CSS `.pp-spec-imgnote` (`:364`) existed unused in JS.
- `collectSpecAttachmentDetailCols` (`:8018–8029`) already required `imgSrc`. Roller preview `appendPreviewRollerDetailsBelowRendering` (`:7867`) skipped spec attachments (and skipped the hardware picker in an earlier pass).
- Spec dropdown change and **Clear** deleted `specAttachmentNotes` (`former :11480 / :11531 / :11567`).

## Root cause

Specs treated the photo as the note. Notes with no image never printed. Spec photos appeared in the Specs column instead of the Details band under the rendering. Clear/spec-change wiped the note.

## Change

- Specs always print `specAttachmentNotes` under the spec label (with or without an image). No `pp-spec-thumb` in Specs.
- Spec photos go to Details via `collectSpecAttachmentDetailCols`; roller merges that into `appendPreviewRollerDetailsBelowRendering`.
- Clear image and changing the spec dropdown keep the note.

## Self-test

- Inline scripts: `new Function` parse, 0 failures.
- File tail `</html>` intact.
- Grep: Specs loop uses `pp-spec-imgnote`; no `delete d.specAttachmentNotes` on Clear.

## Verify (after staging)

1. Ctrl+Shift+R `https://cch-platform-staging.web.app/builder/`
2. Header tag **2026-09-02wo173-builder-full**
3. GRE-W-05: type a spec note with no photo — it prints under Specs.
4. Attach a spec photo — it prints under the rendering (Details), not beside Specs text.
5. Clear the photo — the note stays.
