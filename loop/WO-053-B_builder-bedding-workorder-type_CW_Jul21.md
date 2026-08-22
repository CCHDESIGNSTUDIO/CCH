# WO-053-B — Bedding as new Work Order type
**File:** WO-053-B_builder-bedding-workorder-type_CW_Jul21.md · **Version:** 1.1 · **State:** OPEN
**Priority:** P2 · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Change ID:** FT-015 · **Lane:** Builder (`-B` suffix)
**Source:** Shimano bedding WO. Source doc: `HANDOFF_Pillow_Bedding_Fields_COWORK_Jul21.md`
**Can parallel:** WO-052-B (Pillow) after WO-051-B Application is done; bedding is independent of pillow fields.
**Renumber note:** Dropbox draft was WO-006 — collided with ledger WO-006. Canonical = **WO-053-B**.

## Why
Bedding is room-level, multi-line, sometimes multi-option for client sign-off — not one-item-per-slide. Current Builder cannot capture Shimano-shaped bedding packages.

## Change requested
File: `platform/builder/index.html`.

1. Ensure Bedding is a first-class WO type (tab/type already exists in Builder — ground first; extend, don't fork a second bedding UI).
2. When type = Bedding, render **Bedding spec**:
   - **Room / Bed** freeform (placeholder `Upstairs Guest Bed`)
   - **Option tabs** 1–3 (`Option 1` default). "+ Add option" / remove; max 3.
   - **Line rows per option:** Qty · Item dropdown · Size (optional text) · Material / Description (text)
   - Item dropdown: Duvet · Comforter · Coverlet · Blanket · Bed Skirt · Std Sham · King Sham · Euro Sham · Deco · Lumbar · Bolster · Neckroll · Grand Pillow · Other
   - **+ Add line** per option
3. Materials A–D remain for shared fabrics. Notes textarea as escape hatch.

Persist: `beddingSpec: { room, options: [{ name, lines: [{qty, item, size, materialDescription}] }] }`.

PPTX: multi-option = side-by-side columns; single-option = one column.

## Binding constraints
1. Extend existing bedding scaffolding if present — do not invent a parallel form.
2. Options 2–3 opt-in; default 1.
3. Material / Description is free text — no Product Library auto-link required.
4. No Firestore restructuring beyond adding `beddingSpec` (and related fields).
5. Simpler + collapsible principles apply.

## Acceptance criteria (binary)
1. Bedding WO type shows Bedding spec; hides unrelated type-specific blocks appropriately.
2. "+ Add line" adds a row in the active option.
3. "+ Add option" adds Option 2 (max 3).
4. Save → reload → room, options, lines persist.
5. PPTX: each option as labeled column with lines.
6. Non-Bedding types do not show Bedding spec.

## Verify steps (staging, Cowork)
1. Bedding WO → Room `Test Guest Bed`.
2. Option 1 lines (Shimano-shaped). Add Option 2 with lines.
3. Save; reload; persist.
4. Export PPTX; side-by-side options.
5. Evidence → `loop/verify/WO-053-B/`.

## Rollback
Hide Bedding spec UI; existing `beddingSpec` docs remain in Firestore.

## Attempts: 0 of 3
