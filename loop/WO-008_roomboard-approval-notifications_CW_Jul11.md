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

---

## Cindy Sep 25, 2026 (Tracy Rolling Hills — recurring miss)

Tracy made decisions on the **client portal**. Cindy either does not get notified, or the signal does not stand out.

### What she wants (plain)
1. **Red flag on the project** when she opens it — impossible to miss that the client has pending approve/decline she has not reviewed.
2. **Pepper / staff nudge** in that voice: *"Hey Cindy, from Pepper — Tracy declined and approved certain things. You haven't checked them yet."*
3. Same pain keeps happening — treat as high priority for Studio, not a nice-to-have.

### Grounding already in tree (do not invent schema first)
- `platform/cch-client-activity.js` — Design Boards badge + Communications unread + Client activity panel; reads `activity`, `clientDecisions`, tasks; marks `activity.read=true` when Communications opened. **Room Boards tab badge for line_approved / line_declined is still the WO-008 gap.**
- Portal already writes decision actions; Studio must surface unseen ones on the **project** (not only buried in a feed).

### Proposed acceptance (Cindy confirm)
- [ ] Opening the **project** shows a red / high-visibility flag while there are **unseen client approve/decline** events.
- [ ] Pepper (or staff greeting on that project) says who acted + that Cindy has not checked yet (approve count + decline count).
- [ ] Opening Room Boards / reviewing clears the unseen state (reuse existing unread mechanism if possible).
- [ ] If grounding needs new Firestore fields → stop and ask Cindy (keep BLOCKED-DISCUSSION); otherwise stay schema-light.

**Lane:** Feature / product — **staging first**, then production on Cindy GO. Only Cursor #1 deploys.

### Concrete miss — PRO-3047 (Cindy Sep 25 ~3:27 PT)
Tracy **approved proposal PRO-3047** on the client portal.
- Cindy does **not** know the approval date.
- On the project **Proposals left-hand list**, she does **not** see Approved / Invoice (or any standout status) for that proposal.

So WO-008 is not only Room Board chips + badge. It must also cover **proposal total approval** surfacing:
- Date client approved (visible)
- Status in the proposals sidebar/list (e.g. Approved → ready to Invoice / already Invoiced)
- Same red-flag / Pepper nudge when she opens the project and has not reviewed it
