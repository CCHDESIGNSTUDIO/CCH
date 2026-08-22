# WO-108 DONE — Activity Feed person filter (Cursor · Aug 10)

## What changed
- `platform/index.html` — Activity Feed (`#/activity`)
  - Person chips: **Cindy · Vanessa · All Team** (default = signed-in via email / `currentMemberName`)
  - Composes with Studio/Houzz source, type, project, date
  - Match on `user` / `authorEmail` / `authorName` / `member` / `createdBy` (+ meta)
  - Client-sourced (`authorType:client`, `client_portal`, `client_first_visit`) excluded from staff person filters
  - `logActivity` now stamps `authorEmail`, `authorName`, `authorType: designer` going forward
- Studio build **9.9.135** / tag `wo108-activity-person-2026-08-10`

## Self-test
- Hard refresh `#/activity` as Cindy → Person **Cindy** active; subtitle shows “· Cindy”
- Switch **Vanessa** / **All Team** → list updates; tiles follow filtered set
- Studio source still hides PO-400xxx
- Empty person view shows honest capture-gap copy + “Show All Team”

## Note
Older rebuilt events often have `user: system` — they won’t appear under Cindy/Vanessa until new attributed captures land (WO-085). Filter is correct; capture is the gap.
