# WO-049-B — Builder → Proposal material lines write $0 price
**File:** WO-049-B_builder-proposal-material-price_CW_Jul21.md · **Version:** 1.1 · **State:** OPEN
**Priority:** P0 (trumps WO-050-B … 053-B) · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Change ID:** BF-009 · **Lane:** Builder (`-B` suffix)
**Source:** `HANDOFF_Custom_Order_Builder_CURSOR_Jul21.md` — diagnosed Jul 21, not fixed. Cindy: Create Proposal / Add Fabrics → QTY set, PRICE — / TOTAL $0 (e.g. PRO-3032 Material A while library had a price).

## Why
Builder copies materials onto proposal lines with a too-narrow price read. Studio Product Library uses multiple cost/sell aliases; Builder only looks at `cost` / `unitCost`, so COM picks with client/sell (or `tradeCost` / `costPrice`) land as $0.

## Grounded diagnosis (lead — re-grep before edit)
- `buildProposalMaterialLinesFromWorkOrder` — `platform/builder/index.html` (~3076–3137)
- Roughly: `unitCost = p.cost || p.unitCost` then `clientUnit = unitCost * (1 + markup/100)`
- Studio aliases (see `platform/index.html` ~9226–9227): `cost` / `costPrice` / `unitCost` / `tradeCost` and `clientPrice` / `sellPrice` / `sellingPrice` / `totalSelling`
- Also ensure catalog loaded (`ensureProductLibraryReady` / `resolveMaterialProductById`) before Create Proposal when `productId` set

## Change requested
File: `platform/builder/index.html`.

1. Add a small helper matching Studio price-field aliases (cost family + client/sell family).
2. Prefer library client/sell when present; else cost × markup.
3. Call `ensureProductLibraryReady` (or equivalent) before building material lines when resolving by `productId`.
4. Bump `cch-builder-rev`. Staging only until Cindy GO.

## Binding constraints
1. Document isolation: proposal lines are snapshots — copy prices at create/add time; do not back-sync library later.
2. Minimal diff — do not refactor the whole Create Proposal flow.
3. Empty library price may still yield $0 (honest); do not invent fake prices.
4. Staging deploy via `_DEPLOY_QUEUE.md`; no prod without typed GO.

## Acceptance criteria (binary)
1. COM material with Product Library `clientPrice` (or sell alias) → proposal line PRICE/TOTAL non-zero.
2. COM material with only trade/cost alias → COST filled; client = cost × markup (existing markup rules).
3. Vendor materials without library price behave as today (no crash).
4. `node` parse / page load of Builder has no syntax error; rev meta bumped.

## Verify steps (staging, Cowork)
1. Hard refresh staging Builder → confirm new `cch-builder-rev`.
2. Katke (or staging test) upholstery WO → Material A COM from library with known price → Create Proposal / Add Fabrics.
3. Open proposal Manage: line shows QTY + non-zero PRICE/TOTAL matching library (or cost×markup).
4. Evidence → `loop/verify/WO-049-B/`.

## Rollback
Revert helper + call sites in `buildProposalMaterialLinesFromWorkOrder`. No Firestore schema change.

## Attempts: 0 of 3
