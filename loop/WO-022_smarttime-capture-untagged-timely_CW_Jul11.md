# WO-022 · Smart Time — stop dropping untagged Timely time; assign Service/Project at log time · CW Jul 11
**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Grounding-first** (the Timely→CCH import path isn't grounded in this spec — Cursor must map it before coding).
Ties directly to "get the time-invoice AI working on production" — this fixes the INPUTS the invoice depends on.

## The problem (Cindy, Jul 11, with Timely screenshot for Feb 2)
Timely tracked a full day of Rolling Hills work but it never reached the CCH ledger. Timely's own AutoSheet
for **Mon Feb 2** shows a suggested **"Cloud – Rolling Hills · Ron & Tracey Cloud" entry of 7h 58m**, built
from real captured app time: **SketchUp 3h30m (Fireplaces 6.1), Outlook 1h19m (fireplace design emails),
Windows Explorer 1h30m, Adobe 51m, "Cloud Cabinets" Zoom 46m, LayOut 35m, Enscape 23m.** Timesheet reads
**0h** — the entry was never logged/tagged, so the CCH import (which keys off the tag) dropped it. Result:
~8 billable hours vanished for that one day. This repeats across the year on every untagged session.
**Cindy: "We need to change that — we can always add the service at the time we logged."** The tag must NOT
be a gate; Project + Service can be assigned at import/log time.

## Grounding to do first (cite file:line; report before coding)
- The Timely → CCH import: the **"Import Desktop Log"** action on Smart Time, the `cch-time-log-*.json` format
  (samples in Dropbox `Claude - CCH studio/Time Invoices/` and `Studio Reports/`), and how an entry's tag maps
  to CCH Project + Service today. Find where untagged/unmatched entries are currently filtered out/dropped.
- The **Smart Time → Reconciliation** page (nav under Smart Time) — the natural home for the assign queue.
- The ledger entry model (Project, Member, Date, Service, Description, Billable, Hours, +HRS, Rate) so
  imported rows land complete.

## Two flavors of lost time (both must be handled)
- **(a) Unlogged/suggested, untagged** — e.g. Feb 2: Timely had a 7h58m suggestion that was never logged →
  0h synced.
- **(b) LOGGED but untagged (pre-integration)** — e.g. Feb 9: **4h 39m actually logged in Timely, but no tag
  and $0** because it predates the Timely↔CCH integration. The hours exist and are real; they carry no
  project tag and no rate, so they read $0 and never reached the ledger. This is a whole historical era of
  recoverable time (the ledger caught only 0:15 of that Feb 9 day).

## Change
1. **Import ALL Timely entries/memories for the period — never silently drop an entry for lacking a tag,
   service, OR rate.** Both flavors above are retained. Pre-integration logged-but-untagged entries (showing
   $0) import too; assigning a CCH Service applies the **rate** so the amount computes.
2a. **Multi-project days:** a single day's entries often span projects (Feb 9 has Rolling Hills *staircase
   design* AND Bradbury-High *leather for barstools*). The assign queue is **per-entry, not per-day** — each
   entry gets its own Project + Service, so a day can split across clients.
2b. **Service is OPTIONAL on save everywhere (Cindy, Jul 11):** a **blank service must never block** import OR
   a manual ledger save. An entry with no service saves fine and lands as **Pending / unassigned** (it just
   carries no rate → $0 until a service is assigned). Assigning the service later applies the rate and moves
   it toward billable. So service is never a hard gate — it's assigned when you review, and the Pending view
   (WO-023) keeps unassigned entries visible so they can't get lost. (This is the answer to "did we take the
   service requirement off" — yes: off as a gate, still there as the thing that sets the rate when you're
   ready.)
2. **Assign at log time (the core fix).** In Reconciliation (or the import review step), show an "unassigned
   Timely time" queue. For each entry Cindy sets **Project + Service (default: CCH Design Services) + billable
   + hours**, then logs it. The service/project is applied when logging, not required upfront in Timely.
3. **Preserve Timely's evidence.** Keep Timely's consolidated suggestion (e.g. the 7h58m Rolling Hills block)
   and its app breakdown (SketchUp/Outlook/Zoom/etc.) as the entry description, so each logged hour is
   traceable.
4. **Auto-suggest to speed it up (nice-to-have, not required):** infer the likely Project from the Timely
   entry name / memory content (client name, "Fireplaces", "Cloud Cabinets", file names) and pre-select it;
   Cindy confirms.
5. **Make the leak visible:** a count/badge of unassigned Timely time waiting to be logged, so it never sits
   invisibly again.

## Acceptance (binary)
1. Importing a Timely log that contains untagged entries surfaces them in a Reconciliation "assign" queue —
   none are dropped.
2. Assigning Project + Service + hours to an untagged entry logs it to the ledger as a complete, billable row.
3. The entry's description carries the Timely app breakdown (evidence).
4. A visible count of unassigned Timely time exists.
5. Re-importing doesn't duplicate already-logged entries.
6. Grounding findings reported (import path, where entries were being dropped) before the change.

## Verify (Claude, staging)
Import a sample Timely log with a tagged and an untagged Rolling Hills entry; confirm both reach
Reconciliation, the untagged one can be assigned CCH Design Services + logged, and it shows in the ledger with
hours + app-breakdown description. Screenshot to loop/verify/WO-022/.

## Relationship
Feeds the time-invoice AI (WO/prod work Cindy flagged): clean, complete captured hours are the precondition
for correct time invoices. Do this before/with that.

## DONE note
loop/WO-022_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
