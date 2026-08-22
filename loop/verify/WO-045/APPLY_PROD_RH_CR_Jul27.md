# WO-045 PROD APPLY — Rolling Hills — Cursor Jul 27, 2026

**Project:** `cloud-rolling-hills` (production `cch-design-boards`)  
**Cindy GO:** yes (“can you do it?” after Fable crash)  
**Script:** `_scripts/apply-wo045-cloud-rh-PROD_BY_CURSOR_2026-07-27.js`

## Pre dry-run (prod)

| Metric | Count |
|--------|------:|
| wouldCreate | 87 |
| wouldFillBlank | 41 |
| alreadyMatched | 85 |
| linkedExisting | 52 |
| skippedNoRoom | 13 |
| skippedSuppressed | 0 |
| errors | 0 |
| clips | 458 |

Report: `_backups/WO045_DRYRUN_cloud-rolling-hills_PROD_BY_CURSOR_2026-07-27.json` (overwritten by later passes)

## Apply (2 passes)

Pass 1 created most tiles but 49 lines hit `unroomed-now-has-room` / locked-blank guards and skipped (browser has the same continue-without-create gap). Pass 2 added create-fallback for those cases.

| | Pass 1 | Pass 2 |
|--|-------:|-------:|
| created | 72 | 48 |
| filled blank | 4 | 0 |
| clips | 458→531 | 531→579 |

## Post dry-run (clean)

| Metric | Count |
|--------|------:|
| wouldCreate | **0** |
| wouldFillBlank | **0** |
| alreadyMatched | 265 |
| skippedNoRoom | 13 |
| skippedSuppressed | 0 |
| errors | **0** |
| clips | **579** |

## Still open (code)

`window._cchDocLineClipEnsureApply` remains session-only / default OFF. New proposal lines will **not** auto-create room tiles after reload until a durability WO defaults it on (or persists it). Backfill for RH is done.

## Verify for Cindy

Hard refresh prod → Rolling Hills → Room Boards (MBR & Bath, Kitchen, etc.) → items from PRO-3037 / PRO-3020 / etc. should appear. 13 no-room lines still need a room assigned on the proposal before they can board.
