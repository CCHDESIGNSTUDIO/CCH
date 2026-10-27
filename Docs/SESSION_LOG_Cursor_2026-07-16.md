# SESSION LOG — Cursor — 2026-07-16

**Agent:** Cursor (Grok)  
**Branch:** shared Machine-1 working copy  
**Deploy:** v9.8.84 board sticky/vanish fix — staging + **production** (Cindy GO 2026-07-16 ~15:24)

## Overview

1. Inspiration Board → Client Decisions linking (Post Decision, covers, Open board).  
2. Bug: Client Portal Preview hid studio `.sidebar` — fixed with `cpPortalRestoreStudioChrome` (v9.8.77).  
3. Page background lock — Studio + Client Portal canvas forced `#FFFFFF` (v9.8.79 → shipped in .81).  
4. Project Panel/Tabs toggle bug — clicking Tabs removed the only button to get Panel back (v9.8.81 / sp9).  
5. Design board Print/Export piled tiles — geometry-scale print + Hide Library/Properties.
6. **URGENT:** Tiles “disappearing” — open-board **auto-spread** shoved items past canvas edge (`overflow:hidden`); Back auto-saved dirty boards.

## What changed (latest)

- `platform/cch-design-board.js` — build **20260716db56**
  - **Removed** auto-spread on board open (banner only)
  - **Added** `dbRescueOffCanvasTiles()` on open
  - **Fixed** `dbSpreadStackedTiles` to grow canvas height instead of pushing off the right edge
  - Print geometry-scale + Hide Library/Properties (from db55)
- `platform/index.html` — **v9.8.83**, `cch-design-board.js?v=20260716db56`

## Not deployed yet (needs #1)

- v9.8.83 board vanish + print — `_DEPLOY_QUEUE.md` STATUS: pending (staging) — **URGENT**
- Older pending: trade-cost-push, WO-045

## Deployed earlier today

- Staging + Production: v9.8.77 sidebar restore; v9.8.81 panel toggle + page-bg — Cindy GO

## Verify (after staging deploy of .82)

1. Hard refresh → build **v9.8.82**
2. Design Boards → Cloud Rolling Hills **Slabs** → Print / Export → Print board
3. Chrome print preview: tiles and captions in correct places (not piled)
4. Optional: Save as PDF / screenshot the print preview
5. **Hide Library** / **Hide Properties** → wider canvas; prefs stick across reload
