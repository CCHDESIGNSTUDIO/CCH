# WO-238 DONE — Room Board Hide / Decline / Delete stay on the page

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-18  
**Change ID:** 9.9.353

## Symptom

Cindy: Hide / any Room Board change takes ~1 minute. Then: “All I’m trying to do on the room boards is delete, hide or decline.” Approve/Decline not sticking on all items; Tracey on the client portal.

## Grounding (this turn)

- `setupClipsListener` `platform/index.html:18471–18491` — any clip write after 4s called `renderProjectDetail()`, which sets the page to “Loading project…” and re-fetches the whole project.
- `hideBoardClip` `24777` already patched DOM; Firestore write then triggered that listener. That is the one-minute wait.
- `removeClipFromRoomBoard` `85315` and `deleteClip` `85418` ended with `renderProjectDetail()`.
- `setClipApprovalStatus` `24605` wrote clip `clientSelectionStatus` only. Portal `clientSetRoomBoardStatus` `80984` writes the same field.
- `enrichClipsWithProjectDocLinks` `applyLink` `42871` — if a proposal/invoice line was approved (or invoice **sent**), it overwrote the clip status in memory. Sent invoices stamped every linked clip Approved, wiping Tracey’s Decline.

## Change

`platform/index.html` only:

1. Clips listener: on Room Board tab, do **not** call `renderProjectDetail()` (`18485–18487`).
2. Hide / Show: suppress listener 15s; already in-place gray (`24777`).
3. Decline / Approve / Pending: update badge + dropdown immediately; write clip; 15s suppress (`24605`).
4. Remove from room + Delete: take the card/row off the page immediately; no full project reload (`85341`, `85398`).
5. Enrich: if the clip already has Approved or Declined, proposal/invoice must not overwrite it (`42871–42880`).
6. `CCH_BUILD` **9.9.353** `room-board-instant`.

## Surfaces

- **Intended:** Studio Room Board Hide, Decline/Approve dropdown, Remove, Delete.
- **Must not:** proposal line-by-line Approve (still `lineApprovalStatus` on the proposal). Paid invoices / money. Print layer.

## Self-test

- Grep: `renderProjectDetail` gone from `removeClipFromRoomBoard` and `deleteClip`.
- Listener boards branch returns before `renderProjectDetail`.
- Index tail still `</body></html>`.
- No `node --check` (html only).

## Verify (after #1 staging deploy)

1. Staging `cch-platform-staging.web.app` Ctrl+Shift+R. Sidebar **v9.9.353**.
2. Open a Room Board (not production until GO).
3. Hide — card grays immediately. No “Loading project…”.
4. Decline — badge says Declined immediately. Leave the tab and come back: still Declined.
5. Remove — card gone immediately; still in Selections.
6. Delete — card gone after confirm; not in Selections.

Cannot browser-verify until hosting is deployed (this session is not #1).
