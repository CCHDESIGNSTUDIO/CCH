# WO-113 DONE · Proposal / Selections / Room Boards trilogy · Cursor · Aug 15, 2026

**State:** DONE-UNVERIFIED · **Build:** Studio **9.9.196** / `wo113-p2p3-clip-ensure-staging-2026-08-15`  
**Also bundled:** invoice Open pay bar from **9.9.195** (Pay by card / Pay via Zelle)

## Parts delivered

### Part 1 (already in tree · 9.9.168)
- Board-scoped proposals push product lines into Selections `items[]`
- Filtered header `N of M selections`

### Part 2 (this pass · `index.html` ~13464)
- `cchDocLineClipEnsureWritesEnabled()`:
  - **Staging:** writes ON by default (`CCH_ENV === 'staging'`)
  - **Production:** still OFF unless `window._cchDocLineClipEnsureApply === true`
  - Explicit `false` still forces dry-run everywhere
- Save paths already call `cchRunDocLineClipEnsureAfterSave` (`saveDocLineItem` / `docEditSave`)

### Part 3 (this pass)
- `_loadProjectSelectionSidebarItems`: apply `cchClipShouldHideFromProductViews` (same as Selections tab)
- Empty list copy when filters active: mentions catalog count + Clear Filters / spelling

## Self-test
- `node` not required (HTML inline)
- Staging: save proposal line with room → toast “Room Board updated…” when create/fill
- Prod: after save, still dry-run toast until Cindy sets `_cchDocLineClipEnsureApply = true`

## Verify (staging)
1. Hard refresh → **v9.9.196**
2. `cloud-rolling-hills` Selections — Clear Filters; Arcilla visible
3. Add item rail search arcilla — same products (± library twins collapsed in picker)
4. Edit PRO-3035: add product + room Kitchen → save → Selections + Kitchen room board
5. Open client portal unpaid invoice → Open → Pay by card / Pay via Zelle (9.9.195 behavior)

## Guardrails
- WO-058 suppressions unchanged inside `cchEnsureClipsFromDocLines`
- No library price writes from ensure
- Prod clip writes remain gated
