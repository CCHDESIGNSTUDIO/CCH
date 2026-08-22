# WO-085 · Project Overview "Recent Activity" — capture real recent events, stop backfilling ancient Houzz records · CW Aug 05
**Change ID:** pending #1 · **Lane:** Studio platform (Project Overview) · **State:** OPEN · **Executor:** index.html lane (Cursor per current split; **flag:** this touches many write sites across the 5MB file, so it may OOM Cursor — Code fallback) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html`. Grounded anchors: the project Overview "Recent Activity" render (~21391) reading an `activities` array; the loader (~21010-21020) `db.collection('activity').where('projectId','==',proj.id).orderBy('timestamp','desc').limit(10)`; the global `renderActivityFeed` (~79962) / `rebuildActivityFeed` (~80141). **Staging first; minimal diff; targeted edits, no wholesale load.**

## What Cindy hit (Cloud - Rolling Hills Overview)
Recent Activity shows only 3 items, the newest 32 days old, and one is an **old Houzz invoice IN-12876 dated 550 days ago**. Meanwhile she's been active on this project far more recently than 32 days. Her words: "Why is an old Houzz in recent activity when there's been other activity. It's not capturing correctly."

## Root cause (grounded)
The box reads from a dedicated `activity` event collection (projectId filter, `timestamp desc`, `limit 10`). Two failures:
1. **Under-capture:** many current actions do NOT write an event to `activity` (design boards posted, notes, proposals sent, room-board edits, decisions, time, doc shares, etc. are largely absent), so the feed is starved of real recent events.
2. **Backfill with ancient/migrated records:** because there aren't 10 genuinely recent events, the limit-10 pulls in very old migrated Houzz-era events (IN-12876, 550d) so they surface as if "recent." A 550-day legacy invoice should never present as recent activity.

## Fix
### A. Stop the ancient backfill (contained, do this first)
1. **Recency window:** the Recent Activity box shows only events within a sensible recent window (e.g. last ~60-90 days). If fewer than 10 qualify, show fewer, do NOT pad with year-plus-old records.
2. **Exclude legacy/migration events** from the recent feed: Houzz-import / clip-derived invoice events (e.g. `houzzInvoice`, `_fromClips`, migration-flagged, or the `IN-` legacy numbering) should not appear as recent activity, or at minimum must never outrank real events. Confirm the exact legacy flag on grounding.
3. Ensure the sort uses the true event time consistently (`timestamp` then `createdAt`), and that a missing/blank timestamp doesn't sort to the top or bottom incorrectly.

### B. Capture the events that are missing (the "not capturing" half)
4. **Write an `activity` event for the meaningful actions that currently don't log one** so the feed reflects what's actually happening: proposal sent/approved, invoice created/sent/paid, PO created, room-board item added/removed, clip starred, note added, decision posted, **design board posted**, time logged, document shared. Reuse the existing event shape (`type`, `projectId`, `timestamp`, label) and the existing type color map (`proposal/invoice/po/milestone/note/sms/time`); add types as needed.
5. Keep the global Activity Feed page (`renderActivityFeed`) consistent with the same events.

### C. Wire the Custom Order Builder INTO the Activity Feed (Cindy, Aug 05: "Can we order builder to this activity feed?")
6. **The Custom Order Builder currently logs NO activity events**, so work orders never appear in the global Activity Feed (`#/activity`) or the project Recent Activity. Add events when a builder work order is **created, saved, and revised** (New Revision), tagged with the correct `projectId` so it lands on the right project. Label with the WO number + project + room (e.g. "WES-U-01 · Craft Room work order saved").
7. **Add a "Builder" (Work Orders) filter chip** to the Activity Feed filter row (which today has All / Client Portal / Inspiration / Board Updates / Invoices / Proposals / POs / Clips / Time / Email / Notes / Milestones / Projects). New event `type` (e.g. `workorder` / `builder`) with its own color, filterable by that chip.
8. Builder writes to Firestore from `platform/builder/index.html`; the event-log write should use the same `activity` collection + shape the rest of Studio uses, so both the feed and the project Recent Activity pick it up with no extra work. (Cross-file: this touches `builder/index.html` to emit the event and `index.html` to add the filter chip + color.)

## Guardrails
1. **Display + event-logging only. No financial math, no pricing, no document data changes.** Adding an activity event must not alter invoices/proposals/POs themselves.
2. **No duplicate events / no feed spam** (one event per real action; don't log on every re-render).
3. **Legacy tolerance:** do not delete or rewrite existing `activity` records (including old Houzz ones); just stop surfacing them as recent. Non-destructive.
4. Minimal diff; if the event-logging breadth balloons across the 5MB file (OOM risk), split into A (recency/exclusion, small) shipped first and B (instrument events) as a follow-up, and flag to Fable rather than forcing one giant pass.

## Acceptance (Fable, staging screenshots)
1. On Cloud - Rolling Hills, Recent Activity shows genuinely recent events (days, not the 550-day Houzz invoice). The old IN-12876 no longer appears as recent.
2. Perform a few actions on staging (post a design board, add a note, star a clip): each shows up in Recent Activity promptly.
3. No year-plus-old record appears in the box unless there is genuinely nothing recent (and then it shows "No recent activity" rather than padding with ancient items).
4. **Save a work order in the Custom Order Builder: it appears in the Activity Feed and the project's Recent Activity, tagged to the right project, and the new Builder filter chip shows it.**
5. Financials/KPIs unchanged; no console errors; global Activity Feed still consistent.
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-085 · Project Recent Activity — recency window + exclude legacy Houzz/clip events, and log the missing action events (design board, note, proposal, invoice, PO, star, time, doc) so the feed captures real recent activity · index.html (OOM risk, Code fallback) · build + queue for #1 · staging first.
