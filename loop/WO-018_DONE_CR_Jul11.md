# WO-018 DONE · FFE Schedule click-to-toggle pickers · CR Jul 11
**State:** DONE-UNVERIFIED (staging deploy) · **Polish on WO-014**

## Changes
- `platform/index.html` `renderAllFFE`: replaced native `<select multiple>` with checkbox lists for Projects, Category, Status
- Added `cchAllFfeFilterListHtml`, `cchAllFfeFilterAllToggle`, `cchAllFfeFilterItemToggle`, `cchAllFfeReadCheckboxFilter`
- `cchAllFfeApply` reads checkbox selections; query logic unchanged
- "All" toggle clears specifics; any specific pick unchecks "All"

## Deploy
- **Staging only** (`cch-studio-staging`)
- Production **not** deployed for this WO

## Verify (Claude)
FFE Schedule `#/allffe`: plain-click 2 projects + 2 categories + 1 status, Apply, confirm results match all picks.
