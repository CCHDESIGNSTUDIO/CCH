# WO-002 — Design Board regressions DB-1 / DB-2 / DB-3
**File:** WO-002_designboard-regressions_CW_Jul10.md · **Version:** 1.0 · **State:** OPEN
**Priority:** P1 · **Executor:** Cursor · **Change ID:** BF-### (ask #1 / CHANGE_REGISTER.md for next number)
**Source:** KNOWN_ISSUES.md "Design Board (regressions — May 24, 2026)"; CURRENT_PRIORITIES.md HIGH item 3.

## Inherited diagnosis (LEAD, not evidence — re-grep before editing)
Per KNOWN_ISSUES (fix location `platform/index.html` → `openDesignBoard()`):
- **DB-1** Desktop drag-and-drop onto canvas broken. Expected: drop image files → Firebase Storage upload → element added.
- **DB-2** Room filter missing. Expected: left sidebar Room dropdown filters room-board clips by `clip.room`, defaulting from board `room` or board name.
- **DB-3** Inspiration tab empty. Expected: lists project `ideabooks` images (via `_ibImageUrlFromEntry`), not only legacy URL fields.
Test board: Cloud-Rolling-Hills Kitchen `2kx9yYWTDG7oxFmp80um`.

**IMPORTANT first step:** CURRENT_PRIORITIES (Jun 9) says "fix in `index.html` `openDesignBoard` — verify on staging before production." Ground whether a fix already landed: grep `openDesignBoard`, `_ibImageUrlFromEntry`, `clip.room` filter logic, drag/drop handlers on the design-board canvas. If the fix exists and is already on staging, skip to DONE note stating so (this becomes a verify-only order). If partial or absent, implement.

## Constraints (binding)
- Edit `platform/index.html` directly, Edit-tool string edits, no patch scripts. Never split the file.
- No native alert/prompt/confirm. Navy #0E1629, gold #C9A96E, no pure black.
- Storage uploads follow the existing upload path used elsewhere in design boards; no new storage layout.
- No writes to Product Library or clips beyond what the feature already does (doc isolation rules).

## Acceptance criteria (staging, board 2kx9yYWTDG7oxFmp80um)
1. Dragging an image file from desktop onto the canvas uploads it and adds a canvas element.
2. Room dropdown appears in left sidebar; selecting Kitchen shows only Kitchen clips; default matches board room/name.
3. Inspiration tab lists the project's ideabooks images.
4. Console: zero new red errors on board open and during each action above.

## Verify steps (Claude)
Each acceptance criterion exercised on staging with screenshots → `loop/verify/WO-002/`.

## Rollback
Single-commit revert of the index.html edit via #1 if verification fails hard.

## On completion
DONE note per protocol + one-line handoff appended to `_DEPLOY_QUEUE.md` (STATUS: pending, staging).

**Attempts:** 0 of 3
