# WO-183 DONE · Delete Katke PRO-3016 · CR Sep 03

**Ledger:** WO-183. **State:** DONE-UNVERIFIED.

Cindy: Studio PRO-3016 is a HAL artifact; delete so it does not come back. Vanessa unpublished Katke proposals; one said ~$71K; the $112K row is the one she sees.

## Grounding

- List paints all `boards/{id}/proposals` then `dedupeProposalsByNumber` (`platform/index.html:10113–10137`, used at `:30596`). Same `proposalNum` → keep the copy with the most lines; extras only hidden, not deleted.
- Banner at `:30642` is that hidden-count. Katke’s 3 hidden rows were Houzz **PR-12079 / PR-12692 / PR-12921** twins (lowercase `pr-*` vs `PR-*`), **not** extra PRO-3016 docs.
- Unpublish does not hide a row in Studio (`renderProposalsTab` has no published filter).
- `deleteProposal` (`:37469`) deletes one Firestore id. `tryDeleteFromQB` (`:37444`) never sends proposals to QB (`docType` is null for proposals).

## Production inventory (before)

Board `katke-graceland-dr`. **One** PRO-3016 doc:

| Field | Value |
|-------|--------|
| id | `tORSx2y6Z6UyOHuTdvl0` |
| total | $112,286.61 |
| lines | 223 |
| status | In Review |
| published | false |
| qbDocId | empty |
| created | 2026-05-14 |
| updated | 2026-09-03 |

Reverse links (left in place as documents; pointers cleared):

- Invoice **IN-12936** ($43.56 Sent) `cV0W4fWT4CsHiLz7DnA0`
- **PO-9005** ($990) `DqZ4izInXdWpntNjl1Hp`

No Katke proposal totals ~$71K. Remaining Studio PRO-* after delete: PRO-3017 $1,757.70, PRO-3034 $9,098.60 (still **published**), PRO-3036 $1,188.00.

## What ran

```
node _scripts/list-delete-katke-pro3016_BY_CURSOR_2026-09-03.js --apply
```

Backup: `_backup/katke-pro3016-2026-09-03/`

- Deleted `tORSx2y6Z6UyOHuTdvl0`
- Cleared `linkedProposalId` / `linkedProposalNum` on IN-12936 and PO-9005

Did **not** delete IN-12936 or PO-9005. Did **not** touch Houzz PR-* duplicates.

Re-list: PRO-3016 **NONE FOUND**. 22 docs / 19 unique numbers.

## Verify

https://cch-platform.web.app → Katke - Graceland Dr. → Proposals → Ctrl+Shift+R. PRO-3016 gone. Gold banner still says 3 hidden (Houzz PR twins). Client portal will not show 3016 (it was already unpublished).

## Guardrails

Production Firestore write, Cindy-requested. No hosting deploy. No commit.
