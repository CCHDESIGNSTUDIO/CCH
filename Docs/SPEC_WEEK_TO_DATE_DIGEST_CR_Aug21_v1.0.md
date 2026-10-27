# Week-to-Date digest — report spec v1.0

**Date:** 2026-08-21  
**Layout source:** `C:\Users\cindy\Downloads\CCH_Week_to_Date_EXAMPLE.html` (example figures only)  
**Sequence (Cindy 2026-08-21):** one fact set, two audiences.

1. **Now — us first.** Smart Time → Summaries. Navy/gold Week-to-Date (Daily / Weekly / Monthly) for Cindy and Vanessa. Full staff digest, including hours, Timely recon, POs, money.
2. **Next — bi-weeklies.** Client Portal Updates reuse **that same digest**, filtered to what a client may see (inspiration, design boards, decisions, their proposals/invoices, tasks they care about). Never POs, cost, markup, Timely recon, or staff hours. Studio still curates/publishes; this is the auto-draft source WO-047 asked for.

**Not competing pages:** Activity Feed, Pepper chips, old Weekly Reports health cards. Those can *read* this digest later; they are not step 1.

Grounded against `platform/index.html`, `platform/cch-design-board.js`, `platform/cch-pepper.js`, `platform/cch-followups.js`, `Functions/index.js` on 2026-08-21. Do not invent numbers. Empty section → honest empty line, not sample copy.

---

## Product rules

1. **Layout** matches the example (navy hero, four KPIs, gold/navy hour bars, recon box, tables, Highlights / Needs attention). CSS scoped (e.g. `.st-wtd`); never leak into `.cp-`.
2. **Range:** Weekly = **Monday through today** (`getWeekStart` at `index.html:60353`), labeled like `Monday Aug 17 – Thursday Aug 20, 2026 · through 4:00 PM`. Not rolling last-7 (`_stSummaryRange` today uses end−6 — that is wrong for this digest). Daily = today. Monthly = 1st through today.
3. **Person scope:** Cindy / Vanessa / All Team, same fingerprints as Smart Time + Activity (`member`, `authorEmail`, `user`).
4. **Studio only** unless a section is explicitly client-authored. Drop Houzz (`activityLooksLikeHouzz`).
5. **POs, cost, markup, vendor bills** stay staff-only. Footer note from the example stands.
6. **Staging ≠ production Firestore.** Staging lists will not match Rolling Hills on prod. Timely sync is **production-only** (canon).
7. **Do not** invent recon stories (“likely the Wednesday block”). Delta only, or “Timely hours not loaded.”
8. **Dedupe** money rows by doc number + event (staging already double-logged INV-6013 / INV-6012).

### What this is *not*

| Surface | Why |
|---------|-----|
| `generateWeeklyReport` callable | **Not in live** `Functions/index.js`. Exists only in `Functions/index.js.bak:294`. UI at `generateReportNow` (`index.html:84054`) tries the callable, then falls back to hours + activity **count** with empty invoices/POs. Do not treat that page as this digest. |
| Weekly Reports health-score cards | Different product (`reports` collection). WO-120: do not replace it. |
| Pepper `weekly_brief` | Consumes a digest; it does not render this layout. |
| Portal Updates (step 2) | Same facts, client-safe subset, after staff Summaries works. Do not build the bi-weekly auto-draft first. |

A Friday auto-write can come later (bak schedule was Monday 8am CT). **v1 is on-demand in Summaries.**

---

## Section → source map (v1 — full set from the example)

| # | Section (example heading) | Collection / query | What to show | Honest empty |
|---|---------------------------|--------------------|--------------|--------------|
| 1 | Hero + 4 KPIs | `timeEntries` (top-level) in range, person-scoped; invoiced $ from money rows (below) | Hours logged, billable hours (`_isBillableEntry`), distinct project names with hours > 0, **sum of unique invoice amounts** whose event is sent or paid this period | `0` / `$0` — never sample 31.5 |
| 2 | Hours by project | Same `timeEntries`, group by `project` / board name | Gold bar if majority billable; navy if internal. Treat Studio / admin / CCH admin as never billed. Footnote from example. | “No hours in this period for {person}.” |
| 3 | Smart Time vs Timely | `timelyEntries` (top-level). Timely Logged loads `orderBy('date').limit(2500)` (`index.html:16678`). Filter date + member in memory if composite index missing. | `Smart Time shows Xh, Timely captured Yh. Zh to reconcile.` No “likely …” clause. | “Timely hours for this period are not loaded (staging has no Timely sync).” |
| 4 | Money movement | **Docs, not the activity dump.** `collectionGroup('invoices')`, `collectionGroup('proposals')`, `collectionGroup('purchaseOrders')` under `boards/{projectId}/…`. Paid = Studio fields already pulled from QB (`payments[]`, `qbPaymentId`, `status` Paid, `qbPaymentDate`) — **do not live-call QB** at render. Event: Paid (via QuickBooks) / Sent / Draft / Created after payment. | Table: Document, Project, Event, Amount. Dedupe `INV-` / `PRO-` / `PO-`. Activity `type` invoice/proposal/po is a **hint only** (duplicates exist). | “No Studio invoices, proposals, or POs dated in this period.” |
| 5 | Order Builder activity | `boards/{projectId}/workOrders` (`index.html:17928`). `updatedAt` or `createdAt` in range. Activity `type: builder` is optional overlay. | Custom order title, project, status | “No work orders updated this period.” |
| 6 | POs pending | `collectionGroup('purchaseOrders')` **open now** (not only created this week). Exclude Installed / Received / Cancelled / Houzz per `cchOmIsHouzzSourcePo` if that helper is in scope. | PO #, vendor, status, ETA. Count open vs awaiting confirmation/bill. | “No open Studio POs.” + internal-only footnote |
| 7 | Inspiration added | `boards/{projectId}/ideabooks` — image rows added/updated in range (`updatedAt` on book; per-image `createdAt` if present). Activity: `type: inspiration` **or** `logBoardUpdate` with `meta.boardKind === 'inspiration'` (`index.html:25085+`). **Not** `clips` — clips are Selections / Room Boards. | Project, board name, item titles, count | “No inspiration items added this period.” |
| 8 | Design boards | `boards/{projectId}/designBoards` (`createdAt` / `updatedAt`). Create path `index.html:21042`. Saves stamp `updatedAt` in `cch-design-board.js` (e.g. `:701`). **No** `logBoardUpdate` from that module in current code — query the collection. “Posted to client” = published / client-view flag if the doc has it; else omit that phrase. | Board, project, Created vs Updated (element count) | “No design boards created or updated this period.” |
| 9 | Client activity | Top-level `activity` where `type` is `client_portal` / `client_first_visit` **or** `meta.source === 'client_portal'` (`cpPortalLogClientActivity`, `index.html:73611`). Also inspiration stars/comments with `authorType: 'client'` (ideabook feedback, not the activity writer — portal identity writes `authorType` on stars at `:74444`, not on every activity row). Staff `logActivity` sets `authorType: 'designer'` (`:83529`). **Do not** require `authorType === 'client'` on activity or you will drop portal visits. | Bullets: approved lines, opened proposal, starred images, answered a decision | “No client-authored activity in this period.” |
| 10 | Client decisions posted | `boards/{projectId}/clientDecisions` (same as portal + Pepper `buildDecisionsDigest` `cch-pepper.js:416`). Status `open` / `changes_requested` / answered. Date: `createdAt` or answered-at in range; **also list still-open** decisions (example shows awaiting). | Decision, project, status | “No client decisions posted or waiting.” |
| 11 | Client portal activity | `boards/{projectId}/clientSessions` — `lastVisit` / `firstVisit` (`index.html:73372`). Roll up with `activity` `portal_open` / tab actions (`:73645+`). | Visits this period, last seen, tabs viewed | “No identified portal visits this period.” (anonymous skip = uncounted) |
| 12 | Task status | `boards/{projectId}/tasks` (`index.html:20591`). Counts Done / In progress / Open; list noteworthy rows (done this week, overdue open). | Chips + table | “No tasks in this period.” |
| 13 | Highlights / Needs attention | **Derived**, not a collection. Highlights = 3–5 facts already shown (hours, money, client). Needs attention = recon gap > 0, proposals sent not approved, PO awaiting confirmation, overdue tasks, open decisions. | Cards | Hide a card if that side has zero items. **No AI filler.** |

---

## Corrections to the informal map (so nothing gets invented)

| Informal claim | Actual |
|----------------|--------|
| Inspiration from `ideabooks/clips` | **ideabooks** (+ inspiration activity). `clips` = project selections / room boards — different section, not in the example. |
| Client rows = activity + `clientDecisions`/`clientSessions` with client author type | Decisions + sessions yes. Portal **activity** rows use `meta.source: 'client_portal'` and `user` = client email; `authorType: 'client'` is on **stars/comments**, not the activity add in `cpPortalLogClientActivity`. |
| Money from invoices/proposals/POs + “QB paid-status pull” | Read **already-synced** invoice payment fields. Do not trigger a QB API pull to draw the page. |
| `generateWeeklyReport` is the field map target | Callable **missing** in live Functions. Wire **Summaries** (`renderSmartTimeSummaryView`) first; optionally persist a snapshot to `reports` later. |
| Design boards from activity `board_update` | Design-board module does not call `logBoardUpdate` today. Query `designBoards`. `board_update` is mostly room + inspiration. |

---

## Not in v1 (exists in Studio, not in the example)

Keep these **out** unless Cindy adds them. They are real, not a wish list:

- **Follow-Ups stalls** — `fuDetectStalls` / `fuScanProjects` (`cch-followups.js:407`, `:729`). Old weekly report had a Follow-Ups block; the example does not.
- **Room Boards** — `logBoardUpdate` `boardKind: 'room'`.
- **Selections / clips** added this week.
- **Correspondence / email** activity `type: email`.
- **Client messages** (`boards/{id}/messages`).
- **Files & Docs** uploads.
- **FFE / Spec Book**.
- **Pepper-written prose** for Highlights.

---

## Query notes (so the live page stays cheap)

- Prefer in-memory `timeEntries` already loaded on Smart Time, then fill gaps.
- Activity: `orderBy('timestamp','desc').limit(500)` then filter range — same pattern as `_stFetchActivityRange` (`index.html:58687`).
- Financials / workOrders / ideabooks / designBoards / tasks / clientDecisions / clientSessions: `collectionGroup` where indexed; otherwise iterate active boards (cap, skip Houzz).
- Dedupe invoices by `invoiceNum`/`number`.
- Person filter on client sections: show **all clients of projects that person touched this week**, or All Team = firm-wide. Do not hide RH portal visits because the activity `user` is the client.

---

## Current live gap (why staging looks wrong)

Summaries **9.9.254** is a “What happened” activity list (`renderSmartTimeSummaryView` / `_stFillSummaryActivityList`, `index.html` ~58626–58875). It is **not** the example file. Staging screenshot: KPI **6**, duplicate invoice-sent rows. Rebuild those two functions to this spec; bump `CCH_BUILD`; queue staging.

---

## Verify (after a later build — not this spec-only write)

1. Staging Smart Time → Summaries → Weekly. Hard refresh.
2. Monday–today label; chips Daily/Weekly/Monthly still work.
3. Hours bars match Smart Time for that person.
4. Money table has no duplicate INV rows.
5. Empty sections say empty; no sample $8,900.
6. Client portal Updates page unchanged.
7. Production only on typed GO.
