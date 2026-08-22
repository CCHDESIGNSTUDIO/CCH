# WO-069-B · Fable finding — price PASSES, but COST not populated on Builder-picked line · CW Aug 04
**Change ID:** FT-028 · **Rev:** `ft028b-ghost-filter` · **Verifier:** Fable · **Status: criterion 5 split — price-through PASS, cost-population FOLLOW-UP (holds full sign-off).**

## Observed (staging, Cindy pick-through)
PRO-3012 (Cloud - Rolling Hills, staging), Builder WO CLO-U-01, Upholstery / Craft Room:
- Line: Material A — ALMA - INDIGO, KRAVET, QTY 6 (YRD 6), MKUP 35%, TAX on, **TOTAL $926.10**. Subtotal $926.10.
- **COST cell is blank** on the edit line. Price/total came through correctly (not $0).

## Inference (marked — back-calc from the line, not read from storage)
$926.10 / 6 yds / 1.35 markup → cost ≈ **$114.33/yd**, client ≈ **$154.35/yd**. So a real cost value produced the total; it is simply not written to / shown in the line's Cost field.

## What this is
The **mirror** of the historical Builder $0 bug (HANDOFF_Custom_Order_Builder: trade cost empty + client filled → $0). ft028b fixed the money resolve so the **client price/total** now flows (good, criterion 5's money half). But the **cost basis** is not landing on the proposal line.

## Impact
- Not client-facing: client total is correct.
- Internal: a line with a total and no cost has **no margin basis** — Profit Tracker / margin can't compute, and provenance is invisible (Cindy's exact observation).

## For Cursor (confirm, then fix at source)
1. **Confirm which:** is `cost` stored on the line doc but not rendered in the edit field (display bug), or never captured (data bug)? Read the created line doc for `boards/cloud-rolling-hills/proposals/PRO-3012` and report.
2. **Fix:** in the Builder→line path (`resolveMaterialProductById(clip:…)` + `buildProposalMaterialLinesFromWorkOrder`, `builder/index.html` ~3076-3137 / ~5334+), write the **unit cost** onto the line from the **same linked library product** the client price came from, using Studio aliases (`cost` / `costPrice` / `unitCost` / `tradeCost`). Cost and client should come from one source, so they can't disagree.
3. If it's display-only (cost stored, not shown), surface it in the Cost cell so Cindy can read provenance.

## Guardrails
- Read-only picker still holds: this is writing the cost onto the **new** proposal line at creation, NOT editing library/room/client-visible pricing or any saved proposal. No pricing writes beyond the snapshot the pick already creates.
- Document isolation unchanged.

## Canary hardening (separate, noted from Cindy's DevTools)
The 61 console "errors" on staging are third-party noise: a crypto-wallet extension `inpage.js` (`BitcoinAdapter`, `ExtendedBroadcastMessage`, `IN_PAGE_CHANNEL_NODE_ID`) and New Relic blocked by an ad blocker (`net::ERR_BLOCKED_BY_CLIENT nr-full-*.min.js`). The canary's `no_console_errors` check MUST whitelist these (ignore `inpage.js`, `ERR_BLOCKED_BY_CLIENT`, extension origins) or it will false-fail every run. Measure app-origin errors only.

## Verdict
Criterion 5: **price-through PASS.** Cost-population: **follow-up**, folded into WO-069-B. Full Fable sign-off still held pending (a) cost on the line and (b) the deep picker assert with `STAGING_BUILDER_PROJECT_ID`. Ghost filter (criterion 4) still wants the deep assert / a screenshot of a filtered twin.
