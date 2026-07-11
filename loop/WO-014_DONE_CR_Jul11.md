# WO-014 DONE · Universal FFE Schedule · Cursor · Jul 11, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | Nav **FFE Schedule** under Finance; `#/allffe` route; `renderAllFFE()` filter-first query builder |

## Behavior

1. Page loads empty until **Apply**.
2. Multi-select project / category / status filters.
3. Houzz-style column picker (localStorage); Cost/Margin admin-only.
4. Group toggle Category ↔ Project; column sort; CSV export.
5. Row click → `#/project/{id}/boards`.
6. Uses `ffeFilterProductClipsOnly` + `cchAllFfeClipStatus` (Pending/Approved/Invoiced/Declined).

## Verify (Claude, staging)

- Finance → FFE Schedule; empty state; Apply loads rows.
- Toggle columns; export CSV; Vanessa session hides Cost/Margin.
- Spot-check one project vs per-project FFE tracker.

## Deploy

Staging hosting only.
