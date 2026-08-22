# WO-112 DONE — Smart Time source split (Reconciliation + Week) · Cursor #1 · Aug 13, 2026

**State:** DONE-UNVERIFIED · **Build:** Studio **9.9.162** · **Target:** staging  
**Constraint honored:** UI only — no Timely sync / Functions edits · AI narrative summaries out of scope

## Files touched

| File | What |
|------|------|
| `platform/index.html` | Helpers + Phases A–C; `CCH_BUILD` → 9.9.162 |
| `loop/WO-112_smart-time-source-split-reconciliation_CW_Aug13.md` | Cross-ref CURSOR_TimeAgentPage + Logged |
| `Docs/HANDOFF_SmartTime_Agent_vs_Timely_Reconciliation_CW_Aug13_v1.0.md` | Three sources + coordination table |
| `loop/LOOP_LEDGER.md` | WO-112 row |

## Code (file:line, post-edit)

| Area | Location |
|------|----------|
| `cchTimeSourceBucket` / legend / badge | ~52661–52697 |
| `dayData` capture + logged source splits | ~52767–52838 |
| Week/14-day Timely Cap / Agent Cap cols + Source on expand | ~52950–53040 |
| Missing-time alerts source-aware | ~53044+ |
| `_buildReconCalendar` cell split + legend | ~53120–53170 |
| Smart Time Week source split + legend + Next Week glyph | ~57210–57315 |

## Grounding note

Prior `capturedMinutes` summed `item.duration` on bucket `items`, but bucket items are **indices** into `_pendingCaptures` (see `_tlSaveBuckets` / approve paths). Split now uses undismissed unlogged `_pendingCaptures` by date (+ bucket-index fallback).

## Self-test

- [ ] Staging Smart Time → Reconciliation → **Month**: green Timely / cyan Agent / gold Logged + legend
- [ ] Week / 14-day: Cap columns; expand shows Source badge
- [ ] Smart Time → **Week**: no single lump “captured”; Timely vs Agent lines
- [ ] Activity source pills still work; approve-to-ledger untouched
- [ ] No edits under `functions/` for Timely

## Cross-ref for next WO

**CURSOR_TimeAgentPage_MH_Aug12** — do not queue blind. Read WO-112 outcome first (source badges may change member/project sort display).

## Deploy

Queued `_DEPLOY_QUEUE.md` staging. Prod only on Cindy GO.
