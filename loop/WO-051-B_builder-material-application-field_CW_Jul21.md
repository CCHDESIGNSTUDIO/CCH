# WO-051-B — Application field per Material A–D
**File:** WO-051-B_builder-material-application-field_CW_Jul21.md · **Version:** 1.1 · **State:** OPEN
**Priority:** P1 · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Change ID:** FT-013 · **Lane:** Builder (`-B` suffix)
**Source:** Parsons + Shimano pillow workorders. Source doc: `HANDOFF_Pillow_Bedding_Fields_COWORK_Jul21.md`
**Renumber note:** Dropbox draft was WO-004 — collided with ledger WO-004. Canonical = **WO-051-B**.

## Why
Cindy's real workorders consistently label each fabric with **what part it goes on** (`Front & Back`, `¼" cord welt`, `Trim on sides 14"`, etc.). Live Builder captures fabric (COM/Vendor + Fabric/Trim) but not application — biggest gap vs Parsons voice.

## Change requested
File: `platform/builder/index.html`.

Add a single freeform text input to each material row (A / B / C / D), labeled **"Application"**, positioned near the Fabric | Trim chips. Placeholder: `e.g. Front & Back  ·  ¼" cord welt  ·  Trim on sides 14"`.

Persist under `materials[i].application` (or existing schema path — grep `saveWorkOrder` to confirm). Include in PPTX export.

**Free-form text.** No dropdown, no enumeration.

## Binding constraints
1. Do not enumerate applications as chips or dropdown. Free text only.
2. Empty is valid — do not gate other fields.
3. PPTX export must include the application beneath the fabric details for each letter.
4. Existing WO docs without `application` must render cleanly (backward compat).
5. Simpler + notes principle: do not over-structure.

## Acceptance criteria (binary)
1. Each of Material A / B / C / D has an "Application" text input.
2. Typing triggers existing autosave-to-localStorage path (~2s debounce).
3. Save → reload → value persisted from Firestore.
4. PPTX export includes the application line under the fabric spec for each populated material.
5. Loading a pre-WO-051-B WO doc (no application) renders empty inputs, no console error.

## Verify steps (staging, Cowork)
1. Create WO on staging test project. Material A + application "Front & Back". Save.
2. Reload; confirm value persisted.
3. Export PPTX. Confirm application line under Fabric A.
4. Open a WO created BEFORE this change; confirm no error, inputs empty.
5. Evidence → `loop/verify/WO-051-B/`.

## Rollback
Remove the input/handler. No Firestore migration; docs with `application` simply won't show it if UI removed.

## Attempts: 0 of 3
