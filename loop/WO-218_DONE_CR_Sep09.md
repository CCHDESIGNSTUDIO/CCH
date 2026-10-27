# WO-218 DONE — Files & Docs: move between folders

**Change ID:** 9.9.339  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9: cannot move files between folders in Docs. The ⋮ menu only offered File as QPI / Schedule / WO Docs.

## Diagnosis (file:line)

- `projFileSetShelfCategory` (`index.html` ~19058) already normalizes QPI, Contracts, Drawings, Specifications, Schedule, WO Docs, Invoices, Photos, Other.
- `projFileBuildRowHtml` (~19159) only emitted three File as buttons.

## Change

- File as every shelf folder except the one the file is already in.
- Dropdown `max-height` so the longer menu scrolls.

QPI still sets `internal` + `hideFromClient` when filing **into** QPI. Moving out of QPI does not auto-publish.

## Files touched

- `platform/index.html` — kebab ~19159–19165; `.proj-file-dropdown` ~3088; `CCH_BUILD` 9.9.339

## Verify

Hard refresh staging. Sidebar **9.9.339**. Files & Documents → ⋮ on a Contracts file → File as Drawings (and QPI). File appears under the destination tab.
