# WO-024 · Timely resync only reaches March — let it sync from February (and earlier) · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Unblocks the untagged-time recovery (WO-022). **Staging only. Pause for GO.**

## What Cindy said (Jul 11)
"It needs to go back and sync from February — it says it's only resyncing from March."

## Root cause (grounded this session)
`syncTimelyNow()` **index.html:14345**:
```
var startDate = new Date(Date.now() - 120 * 86400000).toISOString().slice(0,10);  // 120 days back
```
120 days before **Jul 11 2026 ≈ Mar 13 2026**, so the resync window starts in mid-March and **February (and
earlier) is never pulled**. It POSTs `{startDate,endDate}` to the Cloud Function
`timelySyncEntries` (`https://us-central1-cch-design-boards.cloudfunctions.net/timelySyncEntries`).
Second entry point `syncTimelyEntries()` **index.html:61925-61926** defaults to only **30 days** — even
shorter; align it too.

## Change
1. **Let the start date reach back arbitrarily.** Add a **start-date picker** to the Timely sync UI (default
   to a full-year floor, e.g. `2026-01-01`, or the account's first Timely entry) so Cindy can resync from
   February, January, or the whole pre-integration era on demand. At minimum, if a picker is too much this
   pass, change the 120-day lookback to reach **2026-01-01** (or 365 days) so February is always included.
2. **Verify the Cloud Function honors an earlier `startDate` — no server-side floor.** Check
   `Functions/` (the `timelySyncEntries` function): if it clamps or defaults the start date (e.g. to a
   recent window), extend/remove that clamp so a February startDate actually fetches February. **Report what
   the function does before assuming the client fix is enough** — the "only March" behavior may be enforced
   server-side, not just by the 120-day client default.
3. **Align `syncTimelyEntries()` (61925)** to the same floor/picker (drop the 30-day default).
4. **Idempotent resync:** confirm re-syncing an already-synced range does NOT duplicate entries (upsert by
   Timely entry id). Note behavior in the DONE note.

## Acceptance (binary)
1. Cindy can run a Timely sync that starts in **February 2026** (or earlier) and February entries actually
   land — the Feb 2 (~8h) and Feb 9 (untagged) days appear.
2. The sync UI shows/permits the chosen start date; default covers the full year, not just ~120 days.
3. Re-syncing does not create duplicate entries.
4. Cloud-function behavior confirmed (honors startDate / floor removed) and reported.
5. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
Run a sync from 2026-02-01; confirm Feb entries import (spot-check Feb 2 / Feb 9); re-run and confirm no
duplicates. Screenshot to loop/verify/WO-024/.

## Relationship
Precondition for WO-022 (assign untagged time) and the historical recovery — you can't reconcile February
time that never synced. Do this first in the time-recovery chain.

## DONE note
loop/WO-024_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging). Note the cloud-function finding + dedup behavior.
