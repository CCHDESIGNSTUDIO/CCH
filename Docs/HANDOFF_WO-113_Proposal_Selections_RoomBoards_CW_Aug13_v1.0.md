# HANDOFF — WO-113 Proposal / Selections / Room Boards trilogy sync

**For:** Claude (Cowork) or Cursor implementer · **From:** Cursor · **Date:** Aug 13, 2026  
**Canonical WO:** `loop/WO-113_proposal-selections-roomboard-trilogy-sync_CW_Aug13.md`  
**Deploy:** staging only until verified · Queue via `_DEPLOY_QUEUE.md` (#1 commits)

---

## One-sentence problem

Proposal lines on **board-scoped** docs (e.g. PRO-3035) were never added to the Selections tab list; clip ensure (WO-045) is not durable; Add-item picker and Selections tab use different loaders — so items "disappear" while still on the proposal.

---

## What Cursor already changed (Part 1 + UX, build **9.9.168**)

**File:** `platform/index.html` · **Tag:** `wo113a-board-proposal-selections`

1. **`renderSelectionsTab`** — board-scoped `boards/{id}/proposals` now **`items.push`** product lines (same shape as legacy top-level proposals), not `_addProposalLinkForItem` only. Lines carry `_clipDocId`, `_proposalDocId`, `proposal` num.
2. **Header** — when search/room/category/vendor/source/dup filter active, shows **`N of M selections`** instead of misleading `0 selections` on bad search.

**Not implemented yet (still open for this WO):**

- Part 2: default-on `cchEnsureClipsFromDocLines` on doc save (WO-045 durability)
- Part 3: shared loader with `_loadProjectSelectionSidebarItems`; align `cchClipShouldHideFromProductViews` on both paths
- Room Board auto-populate from new proposal lines

---

## Verify on staging (after #1 deploy)

Project: **`cloud-rolling-hills`** · Proposal: **PRO-3035** (`PPJ3cJ99AjQ8okpQI7Nv`)

1. Ctrl+Shift+R → build **9.9.168** / tag `wo113a-board-proposal-selections`
2. `#/project/cloud-rolling-hills/selections` — **Clear Filters**, blank search → count should be **> 0** (proposal product lines included even if clips missing)
3. Search **`Arcilla`** (two L's) → rows appear; header **`N of M`** if filtered
4. PRO-3035 edit → Add item search arcilla → row count should **match** Selections search (same products visible)
5. Room Boards — may still be **gaps** until Part 2 clip ensure ships

---

## Code map (ground before editing)

| Area | Function | Line area (Aug 13) |
|------|----------|-------------------|
| Selections tab loader | `renderSelectionsTab` | ~17927 |
| Board proposal gap (fixed Part 1) | `propSnap2` loop | ~18323 |
| Legacy proposal push (reference) | `propSnap` loop | ~18301 |
| Dedup merge | `_selGroups` / `_selMerged` | ~18420 |
| Product filter | `isRealProduct` block | ~18386 |
| Add-item picker | `_loadProjectSelectionSidebarItems` | ~41368 |
| Clip ensure | `cchEnsureClipsFromDocLines` | ~13060 |
| Write gate (OFF today) | `_cchDocLineClipEnsureWritesEnabled` | ~13332 |
| Dup key | `selDupKeyForItem` | ~17746 |

---

## Part 2 implementation notes (review carefully)

- Turn on writes **staging-first**: e.g. default true when `CCH_STAGING` / orange banner, or explicit `window._cchDocLineClipEnsureApply = true` in staging config only until Cindy GO prod.
- Call sites: `saveDocLineItem`, `docEditSave` (grep `cchEnsureClipsFromDocLines`).
- Honor WO-058: `clipSuppressions`, `_roomUnassignedFrom` — never resurrect deleted/unassigned clips.
- **No price/cost writes** to library or locked docs (`CCH_STANDING_RULE_saved-proposal-pricing`).

Dry-run before prod: `cchDryRunDocLineClipSync('cloud-rolling-hills')` in browser console on staging.

---

## Part 3 implementation notes

- Extract `_loadProjectSelectionRows(projectId)` shared by tab + sidebar OR document why dedup differs.
- Apply `cchClipShouldHideFromProductViews` consistently (tab applies it; sidebar does not — pick one).
- Empty state copy: mention active search when `_selUiFilterActive && sortedFiltered.length === 0 && _selCatalogCount > 0`.

---

## Related open WOs

| WO | Role |
|----|------|
| WO-045 | Clip ensure (partial; durability OFF) |
| WO-058 | Suppressions on unassign/delete |
| WO-092 | Library duplicate dropdown (Parts 2–3) |
| WO-094 | Clipper add images |

---

## Incident context (Cindy, Aug 13)

- villa classica, Arcilla on PRO-3035, missing from Selections tab
- Add-item rail found Arcilla; Selections showed 0 with search typo "Arcadia"
- Image add on Room Board did **not** delete proposal data; display/sync issue

---

## Queue line (when ready)

```text
[2026-08-13 HH:MM] #Cursor WO-113 Part 1 — platform/index.html — staging — Board-scoped proposal lines in Selections + filtered count header. Studio 9.9.168 / wo113a — STATUS: pending
```

---

*Handoff v1.0 · WO-113 Parts 2–3 remain for Claude after Part 1 staging verify.*
