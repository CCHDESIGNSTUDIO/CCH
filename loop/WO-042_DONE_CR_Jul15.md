# WO-042 DONE CR — Design Board resize grips · Jul 15, 2026

**Build:** v9.8.68 (`designboard-resize-grips-2026-07-15`)  
**Where:** staging only  
**File:** `platform/cch-design-board.js` (cache `?v=20260715db50`)

## Shipped
- Moved resize handles out of clipped `.db-el-media` into `.db-el-handles-layer` on `.db-el-frame`.
- Zoom-invariant gold grips via `--db-zoom` CSS variable (28px corners, 44×12px edge pills, 52px hit slop).
- 8 handles: NW/NE/SW/SE + N/S/E/W edge resize.
- Shift key locks aspect ratio on corner resize.
- Properties panel: **Zoom to selection** button + grip usage hint.
- `dbApplyResize` extended for edge directions; resize cursor matches handle direction.

## Verify on staging
1. Open any Design Board → zoom to ~32% (Fit).
2. Select a product → grips should be large gold circles/pills, not tiny dots.
3. Drag bottom-right grip outward → tile grows.
4. Use **Zoom to selection** in Properties.
5. Hold Shift while corner-dragging → proportions locked.

**State:** DONE-UNVERIFIED (Claude/Cindy verify)
