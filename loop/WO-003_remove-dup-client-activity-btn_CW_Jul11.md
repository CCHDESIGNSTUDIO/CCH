# WO-003 · Remove duplicate Client-activity button (tab-bar chip) · CW Jul 11

**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork) · **Attempts:** 0

## Grounded diagnosis (verified live on staging Jul 11, via browser)

`platform/cch-client-activity.js` (build ca3 + Cowork's sidebar-polish append) renders **two** buttons that both call `caTogglePanel()`:

1. `#cchCaHeaderBtn` — the header button next to the project title (added in ca3). Correct placement, carries the unread badge. **Keep.**
2. `#cchCaBtn` — the original tab-bar chip (`caInjectActivityButton`, class `cch-ca-tab-btn`). Now redundant, and it floats over the right edge of the scrolling tab bar (screenshot evidence: chip overlapping the Notes tab on `#/project/cloud-rolling-hills`). **Remove.**

DOM probe on staging confirmed both share the identical onclick. Hiding `#cchCaBtn` live produced a clean tab bar with no loss of function.

## Change requested

In `caInjectActivityButton()` (currently creates/updates `#cchCaBtn` on `.project-tabs`, then calls `caInjectHeaderButton()`):

- Delete the `#cchCaBtn` create/update logic entirely.
- Add `var stale = document.getElementById('cchCaBtn'); if (stale) stale.remove();` so any chip from a cached render is cleaned up.
- Keep the `caInjectHeaderButton()` call — it becomes the sole entry point.
- Bump the console build tag `20260710ca3` → `20260711ca4` (text: "header button is sole entry (tab-bar chip removed) + sidebar polish").
- Do NOT touch the `cchSidebarPolish` block at the end of the file (Cowork's, live as 20260711sb1) or `caInjectHeaderButton`.

*Cowork attempted this edit directly but hit its stale-read issue on this file (its mount served the pre-sidebar 17,174-byte version while disk truth is ~19KB) — hence this order. Re-grep before editing per CODE_GROUNDING_PROTOCOL; the function may have drifted since this diagnosis.*

## Acceptance criteria (binary)

1. On a project page, exactly ONE element whose text matches /client activity/i exists: `#cchCaHeaderBtn`.
2. `document.getElementById('cchCaBtn')` is null after render and after switching tabs.
3. Header button still opens the slide-over panel and still shows the unread badge when > 0.
4. Console logs `build 20260711ca4` and still logs `sidebar readability polish 20260711sb1`.

## Verify steps (Claude, on staging after next deploy)

Open `#/project/cloud-rolling-hills`, run the acceptance probes via console, screenshot tab bar + open panel to `loop/verify/WO-003/`.

## Rollback

Single-file revert of `cch-client-activity.js` to the prior commit; no data writes involved.

## DONE note

Write `loop/WO-003_DONE_CR_[MonDD].md` + append the standard queue line to `_DEPLOY_QUEUE.md` (staging). Do not set VERIFIED; verification closes this order.
