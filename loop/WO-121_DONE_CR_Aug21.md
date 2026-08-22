# WO-121 DONE · Client portal ID leak + phone table + decline paint · CR Aug 21

**Ledger:** WO-121 (handoff titled WO-112; 112 already = Smart Time). **State:** DONE-UNVERIFIED.

## Grounding (this session)

- Chips: `clipLinkedDocPillsHtml` `platform/client.html:4902` (now returns `''`) and former emit at room-board card `client.html` ~10012. Studio Room Boards keep pills at `index.html:23866` and `:41578`.
- Linked PR in product popup: `cvShowProduct` (`client.html` ~10504, `index.html` ~77890) — Linked line removed.
- Table: `cpBuildSingleProposalReviewHtml` → `_cpPremAppendLineRow` + injected CSS `.cp-prem-items-table { table-layout:fixed }` with 130px thumb inside 42% Item column. `@media (max-width:900px)` card stack in both `client.html` and `index.html`.
- Decline: `clientApproveLine` / `clientDeclineLine` were **identical** (await Firestore, then paint; activity already fire-and-forget). Not a Cloud Function. Room board `clientSetRoomBoardStatus` awaited full `renderClientPortal` after write.

## What changed

| File | Change |
|---|---|
| `platform/client.html` | Pills no-op; no Linked PR in modal; card-stack CSS; paint-then-write line decisions; room-board refresh not awaited |
| `platform/index.html` | Same portal clone + CCH_BUILD **9.9.251** |
| Prices | **not touched** — see `Docs/FINDING_REPORT_roomboard-card-price_CR_Aug21.md` |

## Self-test

- `node --check` not applicable (HTML). File tails close `</html>`.
- Firestore read-only only for FINDING.

## Verify on staging

https://cch-platform-staging.web.app/client.html#/clientview/cloud-rolling-hills  
Phone portrait: room cards have no Lib/PR chips; proposal lines are stacked cards; Approve and Decline both full-width. Hard refresh.

**No production** until Cindy GO.
