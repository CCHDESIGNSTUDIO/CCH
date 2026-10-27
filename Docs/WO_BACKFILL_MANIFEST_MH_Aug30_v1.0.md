# Work order back-fill manifest

**WO_BACKFILL_MANIFEST_MH_Aug30_v1.0** · Read-only analysis. No ledger write performed **on Aug 30**.

**Applied Sep 5 (Cursor):** ledger + Group C files + WO-191 code. See `loop/LOOP_LEDGER.md` log. Corrections vs this analysis:

1. Ledger had already continued past 162 (rows 163–190 existed). Next free was **191**, not 163.
2. Group A **WO-100** is implemented as `buildProjectTasksDigest` (`cch-pepper.js` ~473), included in `buildFullDigest` ~991 — entered DONE-UNVERIFIED, not OPEN.
3. Group A **WO-099** copy is already in `cch-client-pepper.js` ~349 / ~610 / ~622.
4. Group C table listed **9** filed bugs; the **10th** unique is the bugs-board duplicate-submit defect (WO-191).
5. Two WO-101s: disk PWA **keeps 101**; Claude-project follow-up loops → **WO-201 HOLD-SPEC**.

**Why this is a manifest and not a ledger edit:** Cursor was actively editing
`loop/LOOP_LEDGER.md` when this ran (mtime 22:18, Aug 30). Two writers on that file loses
one set of rows. Cursor applies this; nobody edits the ledger concurrently.

## Already done, do not redo

The deploy-queue back-fill is **complete**. All 41 rows since Aug 22 carry WO numbers, and
ledger rows 122 through 162 exist. That gap is closed.

---

## Group A — work order file exists on disk, no ledger row (8)

These were written and never entered the table. The file is the spec; the row is missing.
Read each file for real state before assigning one. Do not assume DONE.

| WO | File |
|---|---|
| 059 | `loop/WO-059_promote-9.8.108-to-production_CW_Jul23.md` |
| 096 | `loop/WO-096_timely-window-title-broadcast_CW_Aug07.md` |
| 099 | `loop/WO-099_client-pepper-label-in-training_CW_Aug07.md` |
| 100 | `loop/WO-100_pepper-tasks-in-project-digest_CW_Aug07.md` |
| 101 | `loop/WO-101_pepper-desktop-shell-pwa_CW_Aug07.md` |
| 106 | `loop/WO-106_pepper-all-seeing-firmwide_CW_Aug07.md` |
| 110 | `loop/WO-110_activity-feed-rebuild-studio-only_CW_Aug09.md` |
| 111 | `loop/WO-111_daily-activity-timeline-day-in-review_CW_Aug09.md` |

**Known from the ledger log, use it:** WO-059 is `DONE + PROD-VERIFIED` (Jul 23, 9.8.108 +
clipSuppressions rules, verified live). It should not be entered as OPEN.

**Numbering collision to resolve, not paper over:** two different WO-101s were cut.
`WO-101_pepper-desktop-shell-pwa_CW_Aug07.md` is on disk; the Claude project also holds
`WO-101_pepper-follow-up-loops-po-and-client_CW_Aug07.md`. One needs renumbering to a free
number. Same class of collision the ledger already records six times.

## Group B — number referenced nowhere in the repo (11)

Nothing on disk, no ledger row. Nine of these have specs in the **Claude project**, which
Cursor cannot read. Cindy or Cowork must supply the file before a row means anything.

| WO | Status | Source |
|---|---|---|
| 060 | **Permanent GAP.** Never cut. Tile-name hide (Arcillas). Flagged in the Jul 30 verification ledger as needed; no file ever written. Keep as a `GAP` row, do not invent a spec. | ledger log |
| 079 | Spec in Claude project | `WO-079_design-board-decision-pdf-autofill-images_CW_Aug05.md` |
| 080 | Spec in Claude project | `WO-080_designboard-rotate-element_CW_Aug05.md` |
| 081 | Spec in Claude project | `WO-081_designboard-text-styling-accents-layering_CW_Aug05.md` |
| 088 | Only `WO-088-B` exists in the project (`builder-finish-picker-from-finish-library_CW_Aug05`). Base 088 may never have been cut. Verify before creating. | Claude project |
| 095 | Spec in Claude project | `WO-095_starred-star-icon-rendering-as-question-mark_CW_Aug06.md` |
| 097 | Spec in Claude project | `WO-096-098_timely-smarttime-portal-naming_CW_Aug06.md` (covers 096/097/098) |
| 098 | Spec in Claude project | same as 097. Note: WO-098 portal domain name **must stay additive or it breaks Timely OAuth** |
| 102 | Spec in Claude project | `WO-102_vendor-reply-ingest-and-po-reconciliation_CW_Aug08_v1.1.md`. Second WO-102 collision exists. |
| 103 | Held. Pepper persona step, deferred behind WO-101/102 per `PEPPER_MASTER_PLAN_CW_Aug07_v1.4`. | Claude project |
| 107 | **Unaccounted for.** No spec found in repo or project doc list. Treat as GAP pending Cindy. | none |

## Group C — open bugs never tracked as work orders (10)

Read live from production `feedbackRequests` on Aug 30. **53 rows total: 38 Done, 15 New.**
Of the 15 New, six are one report filed six times and two are a duplicate pair, so the real
open count is **10**. None has ever had a WO number or a ledger row.

Five of the ten are money or billing defects. Those are older than every print regression
worked this week.

| Filed | By | Module | Item | Pri |
|---|---|---|---|---|
| Aug 27 | Vanessa | greene-hixson | Declined line items still print on the approved-items PDF (PRO-3044) | Med |
| Aug 27 | Vanessa | greene-hixson | Her previous bug report is missing from the board | Med |
| Aug 27 | Vanessa | Timetracker | Bartolo proposal import put descriptions on wrong line items; trade cost on installation did not transfer, total correct | Med |
| Aug 11 | Cindy | Other | Pepper upgrade: let Pepper draft a bug / feature / task for review before save | **High** |
| Aug 11 | Cindy | Client Portal | Contractor access to portal docs and decisions (spec written) | **High** |
| Aug 11 | Cindy | Selections/FFE | E-Spec book (spec written, "make this a priority") | **High** |
| Aug 11 | Vanessa | Smart Time | Greene hours reported as spanning two projects on invoice, they do not | Med |
| Aug 11 | Vanessa | Smart Time | Duplicate invoice for the same hours (Katke): create appeared to no-op, she retried, two invoices for one set of entries | **High** |
| Aug 06 | Vanessa | Smart Time | Timely not syncing, "sync failed to fetch" | **High** |

### Two defects in the bugs board itself

1. **No duplicate-submit guard.** Six identical rows in twelve seconds (Aug 11, 19:53:56 to
   19:54:07). The submit button gave no feedback, so Vanessa hit it six times. This is the
   same failure mode as the duplicate-invoice bug she was reporting.
2. **Vanessa's Aug 27 report that a previous report went missing is unresolved.** If reports
   are being lost, 10 is a floor, not a total.

Fix the duplicate guard before asking anyone to file more. Right now, filing a bug about a
button that does not respond reproduces the button that does not respond.

---

## Apply order

1. Group A rows first. Cheapest, fully grounded, files already exist. Resolve the WO-101
   collision as part of it.
2. Group C next, numbered from the current free number. These are real open defects and five
   of them touch money.
3. Group B last, and only where a spec actually exists. 060 and 107 stay `GAP` rows. Do not
   manufacture specs to make the numbering look continuous; a `GAP` row is honest, an
   invented work order is not.

## Not in scope

Ledger rows 123 through 158 have no `WO-###_*.md` file on disk. That is expected: they were
reconstructed from `_DEPLOY_QUEUE.md` during the back-fill, and the deploy line is the
record. Do not generate 36 retroactive work order files to match.

---

*v1.0, Aug 30. Ledger, loop/ and _DEPLOY_QUEUE.md read from disk. Bug board read from
production Firestore through an authenticated session. No file modified, no Firestore write.*
