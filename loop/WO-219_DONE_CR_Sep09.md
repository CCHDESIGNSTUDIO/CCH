# WO-219 DONE — Time Agent navy tabs show project

**Change ID:** 9.9.340  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9 Time Agent: the text on the dark tabs is the issue — project names missing.

## Diagnosis (file:line)

`renderTimeAgentView` (`index.html` ~55808): **By time** (default) used `r.c.date` as the navy group header. Project lived only in the row dropdown. App name (`Google Chrome` / File Explorer `Holtz Hill`) is the card title, not the navy tab.

## Change

- By time and By project: navy tab = assigned `projectName` (or `(no project)`).
- By member: still groups by member.
- Dropped `text-transform:uppercase` so job names read as typed.
- Date stays on the left of each row.

## Files touched

- `platform/index.html` — ~55808–55813; `CCH_BUILD` 9.9.340

## Verify

Hard refresh staging. Time Agent → By time. Navy bars say **Greene** / **Holtz Hill**, not `2026-09-03`.
