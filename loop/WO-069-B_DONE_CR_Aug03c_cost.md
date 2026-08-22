# WO-069-B follow-up DONE — cost on line · #1 Aug 03c

**Rev:** `2026-08-03ft028c-cost-on-line` · **Staging** · Fable finding: price PASS, cost blank

## Confirm (grounded — not guessed)

| Question | Answer |
|----------|--------|
| Display-only? | **No.** Studio Cost cell reads `item.cost` (`cch-proposals-invoices-form.js` / Manage table). Blank = `cost` was **0 or missing** on the saved line. |
| Written at create? | **Yes, intended.** `buildProposalMaterialLinesFromWorkOrder` sets `cost: unitCost` (~3493). |
| Root cause | `builderLibraryUnitPrices` set `clientUnit` from sell when present, but left `unitCost` at 0 when trade-cost aliases were empty → line got amount/clientPrice right, `cost: 0`. Mirror of old $0 bug. |

Did not re-read live PRO-3012 Firestore from this session (canary user / no console SA). Code path proves data bug, not CSS.

## Fix (`platform/builder/index.html`)

1. `builderLibraryUnitPrices` — more cost aliases; if sell>0 and cost≤0, **derive** `unitCost = clientUnit / (1+markup/100)` (Cindy’s 6 yd / 35% / $926.10 → ~$114.33).
2. Material (+ shade COM) lines also set `unitCost` + `costPrice` aliases; prefer real `libraryProductId` when pick was `clip:…` with a library link.
3. Canary: `builder_cost_populated_with_sell`; console whitelist for `inpage.js` / `ERR_BLOCKED_BY_CLIENT`.

## Verify

1. Staging builder hard refresh → rev `ft028c-cost-on-line`
2. New pick → Create Proposal / Add Fabrics → Cost cell shows ~$114.xx (or library trade), not blank; total still correct
3. Existing PRO-3012 line stays as-is until re-add / new proposal (no silent rewrite of saved docs)

## Guardrails

Picker still read-only on library/clips. Cost write is on **new proposal line snapshot** only.
