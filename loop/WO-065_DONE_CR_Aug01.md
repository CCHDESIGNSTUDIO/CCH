# WO-065 DONE — Design Board auto-save after ID heal · Cursor Aug 01

## Files
- `platform/cch-design-board.js` — after open heal (`_healedDupIds > 0` ~1234): call `saveBoardToFirestore({ quiet: true })` once; toast now says “and saved” (was “Save to keep”).
- `saveBoardToFirestore(opts)` — optional `{ quiet: true }` skips flash + “Design board saved” toast (heal path uses its own toast).
- `platform/index.html` — cache buster `cch-design-board.js?v=20260801db65`

## Grounding
- Heal: `dbHealDuplicateElementIds` :72–88; load seed/heal :840–849; post-render toast block :1234.
- Save path reused unchanged (elements + updatedAt write).

## Self-test
- `node --check platform/cch-design-board.js` — OK
- Manual (Fable): open board with dups → one Firestore update; reload → 0 heals / no second save; clean board → no save.

## Deploy
Queued staging with WO-066 batch (or alone if 066 slips).
