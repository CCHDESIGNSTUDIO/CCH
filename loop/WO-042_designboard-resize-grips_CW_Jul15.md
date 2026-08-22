# WO-042 · Design Board resize grips — Canva-scale handles, zoom-invariant, no shrink-on-drag · CW Jul 15
**Change ID:** pending #1 assign (DESIGN-BOARD) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude
`platform/cch-design-board.js`. **Staging first; prod on Cindy GO.**

## Why / what Cindy said (Jul 15)
On Design Boards (Cloud — Rolling Hills Kitchen), resize grips are too small at low canvas zoom (~32%). Dragging them shrinks the product instead of enlarging it. Cindy wants Canva-style grips: large enough to grab, edge + corner handles, and a way to zoom in on a selected tile.

## Root cause (confirmed in code)
1. **Handles lived inside `.db-el-media`** which has `overflow:hidden` — corner grips were clipped; clicks hit the drag handler instead of resize.
2. **Handles scaled with canvas zoom** — at 32% zoom, 22px grips rendered ~7px on screen.
3. **Only one corner** in legacy `index.html` path; external editor had 4 corners but still inside clipped media box.

## Fix (cch-design-board.js)
1. **Frame + handles layer** — product image in `.db-el-frame` > `.db-el-media`; gold grips on sibling `.db-el-handles-layer` (overflow visible).
2. **Zoom-invariant grips** — CSS `--db-zoom` on `#dbCanvasStage`; handle size uses `calc(Npx / var(--db-zoom))` so grips stay ~28px on screen at any zoom.
3. **8 handles** — 4 corners + 4 edge midpoints (n/s/e/w), Canva-style pill edges.
4. **Shift = lock aspect ratio** on corner resize.
5. **Zoom to selection** — Properties panel button + `dbZoomToSelection()` fits selected tile in viewport.

## Acceptance (staging, board 2kx9yYWTDG7oxFmp80um or any)
1. Select a product tile at 32% zoom — grips are visibly large and easy to grab.
2. Drag SE grip outward — tile grows; does not shrink unless dragging inward.
3. Edge grips resize one axis only.
4. Shift + corner drag keeps proportions.
5. "Zoom to selection" centers and magnifies the selected tile.
6. Console: no new errors during resize.

## On completion
`loop/WO-042_DONE_CR_Jul15.md` + `_DEPLOY_QUEUE.md` line (staging).

**Attempts:** 1 of 3
