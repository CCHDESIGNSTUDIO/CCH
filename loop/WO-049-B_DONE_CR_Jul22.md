# WO-049-B DONE — Builder → Proposal material $0 price
**File:** WO-049-B_DONE_CR_Jul22.md · **State:** DONE-UNVERIFIED · **Attempts:** 1  
**Change ID:** BF-009 · **Executor:** Cursor Builder Jul22

## Files touched
- `platform/builder/index.html`
  - `builderParseMoney` / `builderLibraryUnitPrices` after `resolveMaterialProductById`
  - `buildProposalMaterialLinesFromWorkOrder` — uses library aliases (costPrice/tradeCost + clientPrice/sellPrice…)
  - `buildShadeComProposalLine` — same helper
  - `ensureProductLibraryLoaded()` before Create Proposal / Add Fabrics / Bartolo material merge
  - Meta `cch-builder-rev` → `2026-07-22ft015-wo049b-051b` (batched with 050-B/051-B)

## Self-test
- Grep: `builderLibraryUnitPrices` used at material + shade COM paths; `ensureProductLibraryLoaded` at three proposal entry points.
- No inventing prices when library empty (still $0).

## Queue
Appended to `_DEPLOY_QUEUE.md` (staging) with 050-B/051-B batch.
