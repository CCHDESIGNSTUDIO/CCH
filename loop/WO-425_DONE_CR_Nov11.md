# WO-425 DONE — Checklist edit, delete, and notes

Cindy Nov 11. Checklist rows from a decision need edit, delete, and the notes with who said them.

## Files

- `platform/cch-portal-records.js`
  - `checklistNotesFromDecision` / `checklistNotesHtml` — notes from the decision’s response history, with the person’s name.
  - `renderChecklist` — loads the source decision and shows those notes. Staff buttons: Edit, Delete, Mark replaced.
  - Edit updates what, room, date, and how on that checklist row.
  - Delete asks with the styled confirm, then deletes the checklist row. The decision post stays.
  - `cchAddPostedDecisionToChecklist` stores a copy of the notes on the new row.
  - Print includes the names and comments.
- `platform/index.html` — build 9.9.502, script `cch-portal-records.js?v=20261111wo425`
- `platform/client.html` — same script cache

## Self-test

`node --check platform/cch-portal-records.js` passed. Staging hosting 2026-11-11 19:31. Live staging HTML is 9.9.502 and the script contains the delete button and the notes helper. The checklist page was not clicked while logged in.

## Not changed

Decision posts, prices, proposal / invoice / PO / tear-sheet print.

Production hosting 2026-11-11 20:11 Cindy GO. Live check: build 9.9.502, portal script 20261111wo425, variance script still 20261111wo420.
