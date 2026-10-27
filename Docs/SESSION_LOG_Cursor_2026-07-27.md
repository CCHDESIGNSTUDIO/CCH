# SESSION LOG — Cursor — 2026-07-27

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Branch:** shared Machine-1 working copy

## Overview

Staff chat follow-on + Design Board WO-064 (duplicate element IDs). Earlier: Staff chat + Team FAB / images / unstick to prod.

## What changed (this session arc)

| Item | Status |
|------|--------|
| Staff chat photos / copy-paste | **LIVE prod** v9.9.23–24 |
| Design Board Unstick clears selection | **LIVE prod** v9.9.27 / db62 |
| **WO-064** duplicate `el_*` IDs (sticky + vanishing tiles) | **DONE-UNVERIFIED** — v9.9.28 / db64 queued **staging** |
| Portal harden (Katke Welcome/Saving) | Proposed — **not built** |

## WO-064 (afternoon)

- Cause: `nextId` seeded from `elements.length + 1` → duplicate ids after delete/add (Powder Baths: `el_7` ×3).
- Fix: seed from max id; heal duplicates on open; collision-proof `genId`; toast + dirty until Save.
- Files: `platform/cch-design-board.js`, `platform/index.html`; `loop/WO-064_DONE_CR_Jul27.md`
- **Not deployed yet** — `_DEPLOY_QUEUE.md` STATUS: pending (staging). Prod needs Cindy GO.
- No one-off Firestore heal; board self-heals on open+Save after code ships.

## WO-045 prod backfill (afternoon)

- Cindy GO after Fable crash — applied on **production** Rolling Hills only
- Clips **458 → 579**; post dry-run create/fill **0**
- Verify: `loop/verify/WO-045/APPLY_PROD_RH_CR_Jul27.md`
- **Still open:** durable `_cchDocLineClipEnsureApply` default-on (session switch still offs on reload)

## Verify

1. Prod hard refresh → Rolling Hills Room Boards populated
2. Design board Powder Baths: open + Save if heal toast (v9.9.28 already live)
