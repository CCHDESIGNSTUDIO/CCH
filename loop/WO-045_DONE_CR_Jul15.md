# WO-045 DONE CR — Proposal/invoice → Room Board + Selections clip ensure · Jul 15, 2026

**Build:** v9.8.74 (`wo045-doc-line-clip-ensure-dryrun-2026-07-15`)  
**Where:** staging only (queue)  
**File:** `platform/index.html`  
**Numbering:** Cowork drafted as WO-042; **WO-042 already = Design Board grips**. This is **WO-045**.

## Grounding (this session)

| Symbol | file:line |
|--------|-----------|
| `cchPushDocLineRoomsToLinkedClips` | `index.html:12497` |
| `cchEnsureClipsFromDocLines` (+ helpers) | `index.html:12567–12898` |
| `_selEnsureClipsForProjectProducts` | `index.html:16750` |
| `_disBuildProjectClipIndex` (+ `byLibUnroomed` / `byTVUnroomed`) | `index.html:18367` |
| `_disResolveClipIdFromIndex` (room match case-insensitive for TV) | `index.html:18398` |
| `saveDocLineItem` → ensure after room push | `index.html:33894–33900` |
| `saveProposalItem` → delegates to `saveDocLineItem` | `index.html:33712` |
| `docEditSave` → ensure after room push | `index.html:38127+` |

## What changed (Phase 1 only)

1. **`cchEnsureClipsFromDocLines`** — for each eligible product line with a room:
   - Match existing **product+room** clip via `_disResolveClipIdFromIndex` (no stale `line.clipId` short-circuit).
   - Else **fill blank-room** clip (same lib / title+vendor) — never overwrite a roomed clip.
   - Else **create** new clip (product+room identity).
   - Skip labor/expense/header via `cchDocLineEligibleForRoomBoardClip`.
2. **Save wiring** — after `cchPushDocLineRoomsToLinkedClips` on `saveDocLineItem` and `docEditSave`.
3. **Writes gated** — `cchDocLineClipEnsureWritesEnabled()` is **false** until console `window._cchDocLineClipEnsureApply = true`. Save path dry-runs and toasts counts; no Firestore clip writes until flag.
4. **Console tools:**
   - `await cchDryRunDocLineClipSync(projectId)` — full project manifest (proposals + invoices)
   - `await cchApplyDocLineClipSync(projectId)` — apply (still respect freeze / guards)
5. **Phase 2 backfill** — not built.

## Self-test

- `node --check platform/index.html`
- Grep confirms ensure wired at both save paths; writes require `_cchDocLineClipEnsureApply`.

## Verify (Claude / Cindy) — **matcher review before enabling writes**

1. Staging deploy → Ctrl+Shift+R → build **v9.8.74**.
2. Open Rolling Hills on **staging** (or note if project id differs from prod).
3. Console:
   ```js
   await cchDryRunDocLineClipSync('<rolling-hills-projectId>')
   ```
4. Send **totals + sample created / filledBlankRoom / alreadyMatched / skippedNoRoom** rows for sanity-check before any apply.
5. To enable forward-sync writes on staging after OK:
   ```js
   window._cchDocLineClipEnsureApply = true
   ```
   Then save a roomed product line on a proposal and confirm Selections / Room Board.

**State:** DONE-UNVERIFIED (do not mark VERIFIED)  
**Production:** no — needs Cindy GO after staging matcher review.
