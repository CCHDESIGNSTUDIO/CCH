# WO-197 — Bugs board: previous report missing

**CR_Sep05** · Group C · **State:** OPEN · **Pri:** Med

## Symptom (Vanessa, Aug 27)

Her previous bug report is missing from the board. Unresolved. Combined with the six-submit burst, **10 open bugs is a floor, not a count.**

## Lead

Read production `feedbackRequests` (and any archive/status filters, pagination, "Done" hide). Do not assume delete. WO-191 only stops new duplicates; it does not recover a lost row.

## Constraints

- Ground before any Firestore write.
- Staging and production are different projects — the missing row may exist only on prod.
