# WO-286 DONE — Topbar action buttons wrap instead of clipping

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** production hosting (needs Cindy GO). Studio 9.9.375.

## Symptom (Cindy)

PRO-3049 edit: top buttons (Preview, Add item, Email client, Options, Tabs) hide unless the window is wider. Same “screen not resetting to computer size” as before.

## Grounding

- `.topbar` was `height: var(--header-h)` = 52px (`platform/index.html` 1612).
- `spLayoutTopbarCluster` (`cch-project-subpanel.js` 366) and `pepperLayoutTopbarCluster` (`cch-pepper.js` 1305) set `flexWrap: nowrap` + `overflowX: auto` on `#topbarActions`.
- CSS already had `flex-wrap: wrap` on `.topbar-actions`; JS overrode it. Hidden OS scrollbars made the overflow look like missing buttons.

## Change

Functions: `spLayoutTopbarCluster`, `pepperLayoutTopbarCluster`. CSS: `.topbar`, `.topbar-breadcrumb`, `.topbar-actions`.

- Topbar: `min-height: 52px; height: auto` so a second row is not clipped.
- Action buttons wrap. Panel / Tabs / Pepper stay on the right (cluster still nowrap).
- Cache `cch-pepper.js?v=20261007wo286`, `cch-project-subpanel.js?v=20261007wo286`. Studio **9.9.375**.

Did not remove any buttons. Did not restyle the proposal table.

## Affected

Every Studio page that fills `#topbarActions` (proposal/invoice/PO edit and view, project overview). Topbar may grow to two rows on a narrow window. Overlays that pin to `--header-h` (52px) can sit slightly under a two-row bar until those are retied. Not verified in the live browser (hosting not deployed).

## Verify (after production GO + Ctrl+Shift+R)

Katke PRO-3049 edit at 100% zoom, window not maximized: Preview, Add item, Approve for Client, Place on Room Boards, Email client, Auto-save, Tear Sheets, Options, Tabs all visible (wrap to a second row). Options dropdown still opens. Sidebar shows **v9.9.375**.
