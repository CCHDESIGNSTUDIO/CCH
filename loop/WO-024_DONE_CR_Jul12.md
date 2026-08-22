# WO-024 DONE · Timely resync from February · CR Jul 12 · STAGING

**Verifier:** Claude (Cowork) · **Production:** NOT deployed

## Grounding
See `loop/WO-024_GROUNDING_CR_Jul12.md`.

- **Client-only floor** caused March cutoff (120-day / 30-day defaults).
- **Cloud function** honors `startDate`; dedup via `timely-{id}` merge upsert.
- **No server clamp** when client sends February start.

## Shipped
- `index.html` — `timelySyncYearStart()`, `timelySyncStoredStart()`, date picker on Timely Logged tab, `syncTimelyNow()` + `syncTimelyEntries()` use year-start default.

## Cindy action (not Cursor)
Run February resync yourself from Timely Logged → set **Sync from** `2026-02-01` → **Sync from Timely**. Confirm Feb 2 / Feb 9 entries appear; re-run to confirm no dupes.

## Smoke (staging)
`#/timetracker` → Timely Logged tab → Status filter + Sync from date visible.
