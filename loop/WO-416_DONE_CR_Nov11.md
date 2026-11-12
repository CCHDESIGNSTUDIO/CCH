# WO-416 DONE — Files menu is dark and scrolls

Cindy Nov 11 on Holtz Hill Files. The file ⋮ menu is white and runs off the bottom of the window. Photos, Other, and Delete sit below the fold.

## Files

`platform/index.html`

- `CCH_BUILD` line 5026: 9.9.493, tag `file-menu-scroll`
- `.proj-file-dropdown` and `.proj-file-dd-item` around line 3092: navy background `#0A1F3D`, cream text, gold scrollbar
- `projFileToggleDropdown` around line 20066: the open menu height stops 12px above the bottom of the window, capped at 420px, so the rest of the list scrolls inside the menu

## Self-test

Read back the CSS and the height limit. File ends at `</html>`. Production hosting 2026-11-11. Live tag `file-menu-scroll`.

## Verify

Hard refresh Holtz Hill, Files & Docs. Open the ⋮ on a file near the bottom of the list. The menu is navy. Scroll the gold bar to Photos, Other, and Delete.
