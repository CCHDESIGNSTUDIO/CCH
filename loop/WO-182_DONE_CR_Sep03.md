# WO-182 DONE — Invoices list paints without waiting on POs + clips
**Executor:** Cursor · **Date:** 2026-09-03 · **State:** DONE-UNVERIFIED

## Symptom
Cindy Sep 3: Financials / Invoices page taking a long time to load (All Invoices list with “Loading…”).

## Grounding
- `renderAllInvoices` (`platform/index.html` ~73442) awaited `loadFinancialData()` when cache empty.
- `loadFinancialData` (~72618) **waited for `_poOnlyLoadingPromise`** then ran `_doLoadFinancialData`.
- `_doLoadFinancialData` (~72727) loads **proposals + invoices + purchaseOrders** for every board, then a **second pass of every `clips/` collection** to derive Houzz POs.
- All Invoices only needs invoice docs + board names to paint.

## Change
1. Stop serializing full financial load behind PO preload (`loadFinancialData` no longer `await`s `_poOnlyLoadingPromise`).
2. Add `loadInvoicesOnlyFast` / `_doLoadInvoicesOnlyFast` — boards + invoices only, sets `_finCacheIsPartialInvoices`.
3. `renderAllInvoices` first-paint uses invoices-only; after paint, background `loadFinancialData(false)` fills proposals/POs/clips.
4. Cache TTL skip now also respects `_finCacheIsPartialInvoices`.
5. Build `9.9.315` tag `invoices-fast-paint-2026-09-03`.

## Surfaces
- All Invoices (`#/allinvoices`) — first paint faster.
- Full loader still runs in background (proposals, POs, clip-derived POs unchanged once complete).
- Print/PDF not touched.

## Self-test
- JS syntax check: PASS.
- Invoices-only path does not call `clips` or `purchaseOrders`.

## Verify
1. Staging, hard refresh, open **Invoices** (all invoices).
2. List should appear without waiting for PO/clip scan.
3. Totals for the 79 invoices should still match after background refresh finishes.
