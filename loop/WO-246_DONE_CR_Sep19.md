# WO-246 DONE — Room Board open-room view: Rename

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-21  
**Studio:** 9.9.359 `rb-room-rename`

## Symptom

Cindy on Cloud Rolling Hills Room Boards **Consessionss**: cannot edit room spelling. Open-room (focus) view only had **Set cover** and **+ Add item**.

## Grounding

- Focus toolbar: `renderBoardTileView` `platform/index.html` ~24999 — no Rename.
- Rename already exists: `renameRoom` ~27784, wired on List/table ⋮ ~25390 and stacked-section ⋮ ~25067.
- Tile all-rooms cards have no ⋮; click opens focus.

## Change

Added **Rename** on the open-room toolbar (calls existing `renameRoom`). After rename, `_rbGridFocusRoom` follows the new name.

`CCH_BUILD` 9.9.359.

## Surfaces

| Surface | This WO |
|---------|---------|
| Room Board open-room (tile focus) | Yes — Rename button |
| List ⋮ Rename | Unchanged |
| Proposals/invoices/POs | Pre-existing: `renameRoom` still copies the new room name onto matching `items[].room` |

## Verify (staging)

RH Room Boards → Consessionss → **Rename** → Concessions. Hero title updates. Clips in that room keep the new name.
