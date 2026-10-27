# Session log — Cursor — 2026-08-17

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Branch:** wip/preserve-rh-inspiration-board-2026-04-19 (shared Machine-1 working copy)

## Overview

Pepper upgraded to **proactive money + order chase** on projects (proposals/invoices/POs). PO Print Ship To shipped to production earlier today.

## What changed

### Pepper money + order chase (Studio **9.9.216**)
- `platform/cch-pepper.js` → `buildProjectMoneyDigest` (open AR, draft invoices, open proposals, PO confirm/bills/not-received Studio shipping); wired first in `buildFullDigest`
- Firm OM digest includes **Missing bills** for all staff when cache warm; agenda speaks AR / proposals-to-send / PO confirms
- `Functions/cchPepper.js` — proactive presets (money → order → decisions); Airtable note
- `platform/index.html` — **9.9.216**, `cch-pepper.js?v=20260817money1`
- Vanessa how-to updated

### Earlier same day
- Tasks + activity digests (**9.9.215** — superseded by 216)
- PO Print Ship To (**9.9.214**) — **PRODUCTION** ~08:00 Cindy GO
- Design/Inspiration boards (**9.9.213**) — production prior

## Training answer (for Cindy)

Pepper is **not** fine-tuned as a separate course. She is trained via:
1. Standing **CCH Studio platform facts** in `Functions/cchPepper.js` `buildSystemPrompt()`
2. **Live digests** from the open project/page each ask  
Chat still does **not** persist across reload.

## Not deployed / needs GO

| Item | Target | Status |
|------|--------|--------|
| Pepper money + order chase **9.9.216** | staging hosting + `functions:cchPepper` | **STATUS: pending** in `_DEPLOY_QUEUE.md` |
| Same to production | production | Needs Cindy typed **GO** after staging verify |
| PO Ship To **9.9.214** | production | **DONE** ~08:00 |
| Airtable live receiving read | — | Deferred (Phase B) |

## Still not “everything”

- Live Airtable receiver check-ins
- Full line-item dumps (roster is # / status / $ / flags)
- Room Boards tile inventory; Pepper chat after refresh

## Verify (after staging deploy)

1. Hard refresh staging; sidebar **v9.9.216**
2. Open a project → Pepper: “What needs attention today — money first”
3. Expect open AR / draft invoices / proposals / PO confirm+bills listed when present
4. Deploy **both** hosting and `functions:cchPepper`


## Still not “everything”

Pepper still may not see: full Room Boards tile inventory; every financial line unless on that doc/OM; prior Pepper chat after refresh.

## Verify (after staging deploy)

1. Hard refresh staging; sidebar **v9.9.215**
2. Open a project with tasks → Pepper: “List open tasks by priority”
3. Pepper: “What needs attention today?” — should name tasks + activity, not claim it can’t see them
4. Confirm Design Boards still list if present
