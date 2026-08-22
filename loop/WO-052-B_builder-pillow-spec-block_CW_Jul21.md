# WO-052-B — Pillow spec block additions
**File:** WO-052-B_builder-pillow-spec-block_CW_Jul21.md · **Version:** 1.1 · **State:** OPEN
**Priority:** P2 · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Change ID:** FT-014 · **Lane:** Builder (`-B` suffix)
**Source:** Eastern Accents custom_*.pdf + Parsons pillow WOs. Source doc: `HANDOFF_Pillow_Bedding_Fields_COWORK_Jul21.md`
**Depends on:** WO-051-B (Application field). Do WO-051-B first.
**Renumber note:** Dropbox draft was WO-005 — collided with ledger WO-005. Canonical = **WO-052-B**.

## Why
Builder has no pillow-specific spec block. Parsons WOs consistently capture: Type · Qty · Size · Style · Closure · Insert · Trim. One Builder WO should replace one Parsons-style pillow slide.

## Change requested
File: `platform/builder/index.html`.

Add a collapsible section **"Pillow spec"** (visible for pillow WO types). Fields:

| Field | Type | Values / notes |
|-------|------|----------------|
| Work Order Type | dropdown | Sofa Pillow · Bed Pillow · Deco · Bolster · Grand Pillow · Std Sham · King Sham · Euro Sham · Lumbar · Neckroll · Other |
| Qty | number | default 1 |
| Size | text | freeform — do **not** validate format |
| Style | chip single-select | Knife edge · Knife edge w/ flange · Boxed · Self flange · Mitered flange · Ruffle · Insert · Solid · Other |
| Closure | chip single-select | Zipper · Hidden zipper · Envelope · Slip stitch · Other |
| Insert | chip single-select, default Feather/down 90/10 | Feather/down 90/10 · Feather/down 50/50 · Down · Polyfill · Other |
| Trim / Edge | chip **multi-select** | ¼" cord welt · ⅜" cord welt · ½" cord welt · Self welt · Contrast welt · Brush fringe · Tape trim · Tassel · Gimp · ¾" button center · No trim · Other |

Also: prominent **Notes** textarea (escape hatch). Persist under `pillowSpec` on the WO doc.

**Out of scope:** trim size input, custom size validation, auto Size from Type, dimension diagrams.

## Binding constraints
1. Simplicity: if not used on ~80% of pillow WOs → Notes, not a new field.
2. Hide section for non-pillow types (Upholstery / Bedding / Windows).
3. Trim is the only multi-select.
4. Chips keyboard-accessible.
5. Section participates in WO-050-B collapsibility if that ships first (or include collapse in this WO if 050-B not yet done).

## Acceptance criteria (binary)
1. Pillow spec renders for pillow type values.
2. All inputs above present with the listed options.
3. Selecting chips triggers autosave.
4. Save → reload → values persisted from Firestore.
5. PPTX export renders populated values in Design Specifications.
6. Non-pillow types do NOT show Pillow spec.

## Verify steps (staging, Cowork)
1. Type `Sofa Pillow` → Pillow spec appears.
2. Fill Qty/Size/Style/Closure/Insert/Trim (two trim chips). Save; reload; persist.
3. Switch to Upholstery → section hides.
4. Export PPTX → specs on slide.
5. Evidence → `loop/verify/WO-052-B/`.

## Rollback
Revert section render. Docs with `pillowSpec` remain harmless.

## Attempts: 0 of 3
