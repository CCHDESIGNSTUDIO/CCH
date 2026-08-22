# WO-064 DONE — Cursor — Jul 27, 2026

**State:** DONE-UNVERIFIED  
**Build:** v9.9.28 · `cch-design-board.js?v=20260727db64`  
**Deploy:** staged via `_DEPLOY_QUEUE.md` (STATUS: pending) — staging only until Cindy GO for prod

## Root cause (grounded)

Live Powder Baths had three tiles with id `el_7`. On load, `dbEditor.nextId` was seeded from `elements.length + 1` instead of max `el_N` + 1, so after delete+add `genId()` reused existing ids. Id-keyed DOM (`dbFindElementDomNode`, selection grips, patch) only saw the first match → sticky selection + vanishing duplicates.

## Files touched

| File | Lines / what |
|------|----------------|
| `platform/cch-design-board.js` | `dbElIdNum` ~46–49; `dbSeedNextIdFromElements` ~50–58; collision-proof `genId` ~59–71; `dbHealDuplicateElementIds` ~72–89; openDesignBoard load ~840–849; toast after canvas wire ~1232–1239 |
| `platform/index.html` | `CCH_BUILD` → 9.9.28; script `?v=20260727db64` |

## Behavior

1. On every board open: seed `nextId` from highest `el_N`, then reassign only duplicate/missing ids (content/x/y/w/h/clipId untouched).
2. If any healed → `dirty = true` + toast “Repaired N duplicate tile ID(s) — Save to keep.”
3. `genId()` skips any id already present in `elements`.
4. Other add paths already use `genId()` (text/heading/note/arrow/product/clone) — no length-based minting left.

## Self-test

- `node --check platform/cch-design-board.js` — pass
- Grep: no remaining `nextId = …elements.length + 1`
- Id mint sites all call `genId()`

## Verify (Claude / Cindy)

1. Staging deploy → hard refresh → open a design board, delete 2 tiles, add 3 → all unique `el_*`, selection grips land on the clicked tile, Tidy keeps all tiles.
2. Prod after GO: reopen Powder Baths → toast if still duped → Save → all 10 tiles, no sticky `el_7`.

## Guardrails

- No Firestore one-off write in this pass (heal-on-open is the permanent path).
- No commit/push/deploy from this session (#1 / queue).
- Design-board only; clipIds unchanged.
