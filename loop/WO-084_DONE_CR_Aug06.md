# WO-084 DONE — PO page load POs first · #1 Cursor · Aug 06

**State:** DONE-UNVERIFIED · **Verifier:** Fable · **Staging:** with v9.9.94

## Root cause (grounded)

`renderAllPOs` awaited `loadFinancialData()` → `_doLoadFinancialData` (~68005+) which, per project, fetches **proposals + invoices + purchaseOrders**, then clip-derived POs. First paint blocked on the full firm-wide pull.

## Change

| Piece | Behavior |
|-------|----------|
| `loadPOsOnlyFast` / `_doLoadPOsOnlyFast` | Boards + `purchaseOrders` only; **active** Studio projects first; archived PO fetch continues in background |
| `renderAllPOs` | Awaits PO-fast (unless full cache fresh); paints list; kicks `loadFinancialData` in background → `silentRefresh` when done |
| `loadFinancialData` | Unchanged contract for callers; will not early-return while `_finCacheIsPartialPOs`; clears partial flag when full load finishes |
| Export | `_allPosFilteredExport` still set from current `_cachedPOs` on each paint; after full load, silent refresh rebuilds export with complete set |

## Guardrails

- Shared loader not gutted — invoices/proposals/dashboard still use `loadFinancialData` as before.
- No PO number / amount / QB / dedupe logic changes.
- Cache single-flight: `_poOnlyLoadingPromise` + existing `_cacheLoadingPromise`; full load awaits PO-fast if in flight.

## Fable verify (staging)

1. Cold open `#/allpos` — list appears from Studio/active POs without waiting on all proposals/invoices.
2. Archived/legacy POs appear after background fill; filters/export still full set.
3. Totals tiles settle after full load (match prior values).
4. All Invoices / All Proposals / dashboard still load.
5. No console errors. Build tag `9.9.94`.
