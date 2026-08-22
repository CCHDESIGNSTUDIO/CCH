# WO-065 · Design Board: persist duplicate-ID heal on open (stop re-healing every load) · CW Aug 01
**Change ID:** pending #1 assign (DB-CORE) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Fable/Claude
Follow-up to WO-064. Cited: `claude/VERIFICATION_LEDGER_CW_Jul30.md` (Fable), "OPEN" section.

## Why
WO-064 shipped `dbSeedNextIdFromElements` + `dbHealDuplicateElementIds` (v9.9.28, then re-verified live v9.9.48 Jul 30). The heal works and the board no longer freezes, but it only runs IN MEMORY on open. Fable confirmed live on Powder Baths: opening the board heals el_7 x3 -> el_7/el_12/el_13 correctly, but the STORED Firestore doc still holds the old duplicate ids until a human hits Save. Every fresh open re-runs the same heal on the same corrupt doc. One board, healed forever, every single load.

## Fix
After `dbHealDuplicateElementIds` runs and finds >=1 duplicate (dirty flag set), trigger the board's existing save path once, automatically, immediately after heal completes on load. Do not wait for user interaction. If the heal finds 0 duplicates, no save fires (untouched boards stay untouched, no extra writes).

## Constraints
- Touch only the heal -> save wiring in `cch-design-board.js`. No new UI, no new dialog, no toast beyond what WO-064 already added.
- No change to `genId` or `dbSeedNextIdFromElements` themselves, those are correct as shipped.
- Standing pricing rule (`claude/CCH_STANDING_RULE_saved-proposal-pricing_CW_Jul31.md`) does not apply here (no price/cost fields touched), noting only because it's a hard constraint on all writes now.

## Verify (Fable, staging then prod)
1. Open a board with known duplicate ids (or seed one) -> confirm heal + auto-save fires (network tab shows the write, or `updatedAt` bumps).
2. Reload the SAME board a second time -> 0 duplicates found, no second save fires (idempotent).
3. Open an already-clean board -> no spurious save.

## DONE note
`loop/WO-065_DONE_CR_[MonDD].md`.
