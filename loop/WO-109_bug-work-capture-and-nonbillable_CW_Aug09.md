# WO-109 — Bug-work: make it visible, and never bill it

**CW_Aug09** · Lane: **Cursor** (Bugs board + Smart Time + activity + Pepper) · Extends WO-108 (person filter) / WO-085 (capture) / WO-105-106 (Pepper). Billing philosophy per `cch-cfo`.

## The lesson (7/21, real)
Vanessa spent ~an hour fighting a broken Builder (work orders wouldn't save, costs weren't transferring). She filed the bug at 1:00 PM. That time is **real but NOT billable** — the client shouldn't pay for the studio's own broken tool. Two failures this exposes:
1. **Invisible:** the bug-work left no artifact except the bug report, so the Activity Feed and time reconstruction missed it entirely.
2. **Mis-billable:** if Pepper captured "51 min on Studio" and billed it, she'd wrongly charge the client for bug-fighting.

Capturing time was never enough. It has to be **classified**.

## Change
1. **Bug events into the Activity Feed + agenda.** When a bug is filed or updated on the Bugs board (`feedbackRequests`, `cch-bugs-requests.js`), write an `activity` event (type `bug`), attributed to the filer. Now bug-work shows up in the feed, the WO-108 person filter, and Pepper's fingerprint agenda (WO-105/106). (This is the Bugs-board → activity bridge; the board stops being an island.)
2. **Classify bug-time as non-billable — suggest, don't silently auto-mark.** When a person's tracked time overlaps a bug they filed / were working (bug timestamp + Timely/desktop-time in that window, Builder or broken-tool context), Pepper **flags that block as likely internal / non-billable and asks the human to confirm**: *"That hour on 7/21 lines up with the Katke work-order bug you filed at 1:00 — mark it internal, not billable?"* Confirmed blocks are **excluded from billable hours and invoice drafts**. Never bill bug-fighting to a client. Human can always reclassify.
3. **"Time lost to platform bugs" tally.** A running internal metric: hours the studio absorbed fighting its own bugs, by month and by module (Builder, Invoices, etc.). Surface in the intelligence / Profit view and in Pepper's brief: *"We lost ~6 hrs to Builder bugs this month."* This is both a cost you're eating and the ROI case for fixing the tool.

## Guardrails
- Non-billable classification is **internal only**, never exposed to clients; always human-confirmable (default suggestion, not silent write).
- Draft-only for anything touching an invoice (per standing rules).
- **Accuracy:** the "lost to bugs" number is real, computed from actual bug + time correlation, never estimated. If the correlation is a guess, Pepper says "looks like" and asks, per the honesty rule.
- Bug events are **staff/internal** (not client-facing) per `CCH_STANDING_RULE_client-visibility-boundary`.

## Grounding
`feedbackRequests` (`cch-bugs-requests.js`) for bugs; Smart Time / `timeEntries` billable flag for classification + exclusion; the `activity` event shape for the new bug events; `cchFixItBot` threads as extra signal; Pepper digests (WO-105/106) to surface it.

## Acceptance
1. Filing/updating a bug writes a person-attributed `activity` event; it appears in the feed under that person's WO-108 filter.
2. Time overlapping a filed bug is surfaced as "likely non-billable"; on confirm it's excluded from billable hours + invoice drafts; a client is never billed for bug-work.
3. A real "hours lost to platform bugs" figure is computed (by month/module) and shown to staff + in Pepper's brief.
4. Reconstructing 7/21 now shows: Katke proposals (billable) + the Builder bug-fight (internal, not billable), not one undifferentiated blob. Staging → prod on Cindy's GO.
