# WO-206 DONE — Timely: Vanessa Dec–Mar pending closed

**Change ID:** 9.9.326  
**Date:** 2026-09-08  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 8: Vanessa does not want Dec–March Timely **open pending** (Dec–Feb invoiced in Houzz; March she entered by hand). They inflate Pending (159). She only cares about **April forward**. Gray those months; drop them from Pending counts.

## Diagnosis (file:line)

- `renderTimelyLoggedView` `platform/index.html` ~17400: `pendingTotal` = every Timely row not in `loggedIds`. No date cutoff.
- Month bars ~17518: same — orange “31 pending” on March, etc.
- Rows ~17629: unlogged = orange **Pending** + checkbox. Select All Pending would include Houzz-era rows.

No Firestore write. Display + counts only. Entries stay in `timelyEntries`.

## Surfaces

| Intended | Must not |
|----------|----------|
| Timely Logged Entries pending counts, month bars, row status | Cindy’s pre-April pending (only Vanessa is closed) |
| | Ledger `timeEntries`, invoices, Houzz data |
| | Sync-from-Timely (prod-only) |

## Change

- `timelyEntryIsHouzzEraClosed`: Vanessa + `date < 2026-04-01`.
- `timelyEntryIsOpenPending`: not logged and not Houzz-era closed.
- Pending pill + card use open pending only. **Pending** filter hides Dec–Mar closed rows.
- Those months: gray header, **Closed** instead of orange pending, collapsed until she expands.
- Row: gray **Closed**, checkbox off. Select All Pending skips them.

Studio **9.9.326**.

## Self-test

- Grep: `CCH_TIMELY_ACTIVE_PENDING_FROM`, `timely-month-historical`.
- File tail `</html>` intact.

## Verify after staging

Hard refresh. Sidebar **9.9.326**. Smart Time → Timely Logged Entries → Vanessa Holliday.

- **Pending** ~10 (April 1 + September 9), not 159.
- Dec / Jan / Feb / Mar bars gray, **Closed**, collapsed.
- April+ unchanged (April 1 pending still counts).
- Pending tab: no Dec–Mar rows.
- All tab: those months still there if she expands.
