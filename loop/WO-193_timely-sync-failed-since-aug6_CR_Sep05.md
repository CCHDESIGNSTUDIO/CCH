# WO-193 — Timely not syncing since Aug 6

**CR_Sep05** · Group C · **State:** OPEN · **Pri:** High · Money

## Symptom (Vanessa, Aug 6, Smart Time)

Timely not syncing. Message: "sync failed to fetch".

## Lead

Timely is **production only** — staging has no Timely sync. Ground `timelySyncEntries` / `CCH_TIMELY_FN_BASE` / Settings Connect Timely. Do not "fix" staging as if it were prod.

## Constraints

- Secrets stay in `*-pat.env` / `firebase secrets:set`. Never paste tokens in chat.
- Ground before any Functions edit.
