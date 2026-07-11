# WO-017 · Bugs & Requests functional — report-from-anywhere + threaded chat + unread badge (in-app only) · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## What Cindy asked (Jul 11)
Make Bugs & Requests a real in-app workflow: report from anywhere, threaded discussion, unread badge — **not**
email-only. Full grounded spec reviewed in Dropbox `BUGS AND FEATURES/CURSOR_BugsRequests_GROUNDED_CW_Jul11_v1.1`
(MH draft extended by CW). **EXTEND the existing `feedbackRequests` collection — do not rebuild.**

## Grounded anchors (verified in index.html this session)
- **Route:** `navigate()` page `feedbackrequests` → `renderFeedbackRequests()` (:5132, :62956).
- **Nav:** Sidebar Bugs & Requests button (:3288).
- **Collection:** `feedbackRequests` — 25+ live docs; fields include `type` (Bug/Feature/Improvement/Question),
  `status` (New/Received/In Progress/Done/Closed/Blocked), `title`, `description`, `response`, `received`,
  `receivedAt`, `ownerName`/`ownerEmail`, `createdAt`, `updatedAt`, `submittedBy`.
- **List UI:** filter chips (Bug/Feature/Open/My Open/Stale/Unowned/Not Received), status colors, Reply modal
  (`showNewFeedbackModal`, `submitFeedbackRequest` ~63307).
- **Role gate:** email-based (`ADMIN_EMAILS`, submitter email) — not uid-based. Open Q from spec: confirm
  Vanessa logs in as herself (not shared admin).

## What to build (from grounded spec — see Dropbox v1.1 for full detail)
1. **Report from anywhere** — floating/submit entry or context menu from project pages, doc views, and
   sidebar; prefill `projectId`, `page`, `url hash`, screenshot optional later.
2. **Threaded chat** — `messages[]` sub-array or subcollection on each request; author, body, timestamp;
   show thread in detail drawer/modal; append on reply (not overwrite single `response` field only).
3. **Unread badge** — per-user `lastReadAt` or unread count on nav item; mark read on open thread.
4. **In-app only** — no external email bridge required for v1; keep existing Firestore rules pattern.
5. **Preserve** existing status flow (New → Received → In Progress → Done), filters, and owner assignment.

## Constraints
- EXTEND `feedbackRequests` schema compatibly (don't orphan the 25 live docs).
- Navy/gold; never split index.html; `node --check` + tail after edit.
- Vanessa visibility: she sees her submissions + studio-wide open items per spec (confirm with Cindy).

## Acceptance (binary)
1. User can file a bug/request from at least project detail + global nav without navigating away first.
2. Replies append to a visible thread; original `response` field still works for legacy rows.
3. Nav badge shows unread count for the signed-in user; clears on read.
4. Existing list page + filters still work; zero console errors.

## Verify (Claude, staging)
Submit from a project page; reply in thread; confirm badge; screenshot to `loop/verify/WO-017/`.

## DONE note
`loop/WO-017_DONE_CR_[MonDD].md` + `_DEPLOY_QUEUE.md` line (staging).
