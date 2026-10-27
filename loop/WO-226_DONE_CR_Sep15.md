# WO-226 DONE — Payout category per entry (Eden last-row-wins)

**Change ID:** 9.9.346  
**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy: Time Ledger showed Eden hours Billable; contractor payout labeled the whole project Non-Billable. Vanessa already paid on the correct billable rows. INV-6076 Sent Sep 14 $1,096.25.

## Diagnosis (file:line, this session)

Production Firestore: 7 Vanessa Eden rows Aug 16–31. Six `billable: true` on INV-6076. One Aug 17 0.50h `billable: false` (Admin email).

Payout wrote `byProject[proj].category` inside the per-entry loop (`index.html` was 53117–53122). Last entry won. Hour log and CSV used that project label for every row.

## Change

- Added `_payoutEntryCategory` / `_payoutCatLabel` / `_payoutCatColor` at `index.html` 53006–53018.
- Removed the project-level category overwrite.
- Hour log service rows and CSV Category column use each entry’s own flag.
- **Pay math unchanged** (`totalPay = totalHrs * memberRate` still). No `timeEntries` writes.

## Not in this WO

Full payout BF-DRAFT-A/B (trackedHrs, named deductions, 2022 columns, CCH toggle). Leakage and Smart Time summaries WOs still open.

## Verify

Hard refresh. Sidebar **9.9.346**. Financials → Subcontractor Payout → Vanessa → Aug 16–31. Under Eden: Design Services / Design Concept / Client Project Support = **Billable**; Non-Billable 0.50h = **Non-Billable**. Export CSV: same split, not one Non-Billable stamp on all seven rows.
