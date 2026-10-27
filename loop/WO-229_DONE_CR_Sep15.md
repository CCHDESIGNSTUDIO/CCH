# WO-229 DONE — Houzz pending vs actually owed (read-only)

**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (audit, no hosting)

Cindy: go through Houzz open POs on `#/allpos/pending` vs QB bills; year-end cleanup.

## Grounding

Pending uses `cchPoIsOpen` (`cch-po-bill-variance.js:663-669`): not received/cancelled/installed/paid/closed/delivered. Fast path loads `purchaseOrders` only; the 888/400 Houzz rows on that page are **clip-synthesized** (`poNum` on clips, id `clip-po-*`) after full load (`index.html` ~31910-31940).

## Production counts (15 Sep 2026)

- 2,289 `purchaseOrders` docs; **22** Houzz-numbered docs, **all already closed**
- **82** open Houzz rows are clip-only
- **62** of those have $0 remaining (paid on the clip, still Ordered)
- **20** still show a Studio balance, **$12,139.65** total, no `qbBillId`
- Live QuickBooks bills were **not** queried (would rotate the refresh token from a local script)

CSV: `_debug/HOUZZ_OPEN_POS_VS_STUDIO_QB_FIELDS_BY_CURSOR_2026-09-15.csv`

## Not done

No status writes. Need Cindy’s QB Unpaid Bills xlsx to finish the 20.
