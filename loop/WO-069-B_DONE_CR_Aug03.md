# WO-069-B DONE — #1 Cursor Aug 03

**Change ID:** FT-028 · **Rev:** `2026-08-03ft028b-ghost-filter` · **State:** DONE-UNVERIFIED · **Target:** staging  
**Verifier:** Fable

## Grounding (this turn)

| Criterion | Finding | file:line |
|-----------|---------|-----------|
| 1 Project materials default | `openFabricWorkOrderPickModal` loads clips, `scope = project` when `projectRows.length` | `builder/index.html` ~5334–5350, 5369+ |
| 2 All Product Library F&T only | `buildMaterialPickList(..., { fabricTrimCatalogOnly: true })` | ~5341 |
| 3 Scoped search | `paint()` filters `base = scope === "project" ? projectRows : allRows` | ~5364–5367 |
| 4 Ghost filter | **MISSING on ft028** — STOP. Studio filter at `index.html` ~40908 | fixed this turn |
| 5 Price on select | Clip resolve had **no cost/clientPrice**; `loadInspirationItems` omitted money fields | fixed this turn |
| 6 Vendor path | Unchanged (COM vs Vendor branches) | — |
| 7 Rev meta | was `ft028-fabric-pick-project-first` | now `ft028b-ghost-filter` |

## What #1 changed

1. `loadInspirationItems` — also loads `room`, sell/client/cost, `libraryProductId` (read-only for picker).
2. `builderFilterGhostPickerClips` — same rules as Studio `_disFilterGhostPickerClips`.
3. `buildMaterialPickList` — clips pass through ghost filter before push.
4. `resolveMaterialProductById(clip:…)` — prefer linked library product for unit money (WO-049-B / criterion 5).
5. Canary — `builder_rev_ft028`, `builder_ghost_filter_wired`, optional deep checks if `STAGING_BUILDER_PROJECT_ID` in env.

**No pricing writes** on open/select beyond existing snapshot apply. **No doc isolation changes.**

## Staging verify for Fable

1. https://cch-platform-staging.web.app/builder/ → Ctrl+Shift+R  
2. View source: `cch-builder-rev` = `…ft028b-ghost-filter`  
3. Project with fabrics → Material A → Product Library → Project materials populated; no sub-$1 twin junk  
4. All Product Library = Fabric & Trim only; search scoped to active tab  
5. Pick COM → yards → Create Proposal still carries real $ (not $0)  
6. Canary: `_scripts/canary` with optional `STAGING_BUILDER_PROJECT_ID=`
