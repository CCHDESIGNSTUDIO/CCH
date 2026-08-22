# WO-093 DONE — Client unit price ceil to $5 · CR Aug 07

**Cindy lock:** round **unit** price up (`Math.ceil(p/5)*5`), not line total.

## Grounding
- Primary: `recalcProposalLineAmount` (~8350) set `amount = cost*qty*(1+m/100)+ship` with no rounding
- Live editor: `docEditUpdateItem` / save recompute also raw
- Add-item: `addSidebarProductToDoc` computed unrounded sell

## Change
1. `cchRoundClientUnitPriceUp5` + `cchClientUnitFromCostMarkup` + `cchLineShouldRoundClientUnit` (skip freight/tax/expense/credit)
2. `recalcProposalLineAmount` sets `clientPrice` = ceil unit, `amount` = unit×qty + ship
3. Doc-edit live + save paths use same helper
4. Add-item paths: `addSidebarProductToDoc`, bundle add, selections row, library multi-add, generate-from-clips
5. Fill-empty economics from library uses ceil unit
6. Manual TOTAL (`amount`) edit still respected (no forced $5)

## Build
Studio **9.9.108** / `wo093-client-price-ceil5-2026-08-07`

## Verify (staging)
1. Proposal line: cost $100, markup 50% → unit was $150 → stays $150; $763.26 raw → $765
2. Qty 2 → line total $1,530 (not ceil of $1,526.52)
3. Shipping stays additive unrounded
4. Freight/expense lines not forced to $5
