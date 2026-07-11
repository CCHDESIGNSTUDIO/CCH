# WO-008 · Room boards — client approve/decline notifications · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Cindy's words
"Clients can approve items on a room board and or a proposal. On the room boards we should have notifications if a client has approved or declined."

## Change
Clients act on room-board items (and proposal lines) from the portal; the studio room-board view must surface that:
1. Item tiles already carry approval status dropdowns — add a visible state chip when the CLIENT set it (green "Client approved" / red "Client declined", with relative time), distinct from studio-set status.
2. Room Boards tab badge: count of client approve/decline events not yet seen (reuse the cch-client-activity unread mechanism — activity actions line_approved / line_declined / room-board approvals — rather than inventing new tracking).
3. Board header: small summary line "Client: N approved · M declined" per room.
Ground first: where portal approval writes land for room-board items (clip fields vs activity) and reuse `_cchCaGetBadgeCounts()` exposure from cch-client-activity.js where possible.

## Acceptance
1. A client approval made in the portal appears on the studio room board within one refresh, visually distinct from studio-set status.
2. Room Boards tab badge counts unseen client decisions; opening the board clears them.
3. No new Firestore schema unless grounding proves none exists for client attribution; if schema IS needed, stop and flag BLOCKED-DISCUSSION instead of inventing fields.
