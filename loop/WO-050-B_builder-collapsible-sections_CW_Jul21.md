# WO-050-B — Collapsible sections across Builder form
**File:** WO-050-B_builder-collapsible-sections_CW_Jul21.md · **Version:** 1.1 · **State:** OPEN
**Priority:** P1 · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Change ID:** FT-012 · **Lane:** Builder (`-B` suffix)
**Source:** Cindy verbatim: *"All sections should be collapsible — it gets overwhelming."*
**Renumber note:** Dropbox draft was WO-003 — collided with ledger WO-003. Canonical = **WO-050-B**.

## Why
The Builder form has grown past what fits in one visual pass. Collapse-by-default for advanced blocks reduces cognitive load with no loss of function.

## Change requested
File: `platform/builder/index.html` (canonical `C:\dev\CCH-Platform-Deploy\cch-deploy\`, not Dropbox copy).

Wrap each form section header in a `<details>` (or equivalent JS-managed disclosure) with these defaults:

- **Default expanded:** Project Info · active WO Type spec block · Materials A–D · Notes
- **Default collapsed:** Image swatch uploads · Past-workorder browser · Delete / danger blocks · Revision history · Any advanced spec blocks

Persist open/closed state per-user in `localStorage` under key `builderSectionCollapse` (map of `sectionId → bool`).

Keep the "Save work order" bar sticky / always reachable regardless of what's collapsed above.

## Binding constraints
1. No section is REMOVED — only collapsed by default.
2. Open state must survive page reload (via localStorage).
3. No dependency added (native `<details>` or inline JS only).
4. Do not restructure section order — only add the collapse affordance.
5. Guiding principles: simpler + notes escape hatch; collapsibility applies to the **whole** form.

## Acceptance criteria (binary)
1. Every top-level form section on `/builder/?projectId=…` is inside a `<details>` (or equivalent) with a click-to-toggle header.
2. On first load with a clean localStorage: Project Info + WO Type spec + Materials + Notes are expanded; all others collapsed.
3. Toggling a section, reloading, and returning to the page shows the same open/closed state.
4. "Save work order" remains visible / clickable at all times.
5. Toggling collapse does NOT trigger autosave or Firestore write.

## Verify steps (staging, Cowork)
1. Open `cch-platform-staging.web.app/builder/?projectId={test}` — fresh incognito.
2. Confirm criteria 2 (default expanded/collapsed set).
3. Collapse Project Info, expand Image swatches. Reload. Confirm state persisted.
4. Click Save. Confirm no error; work order saves.
5. Screenshots → `loop/verify/WO-050-B/`.

## Rollback
Revert the section-wrapper change. No schema / Firestore change means no data migration required.

## Attempts: 0 of 3
