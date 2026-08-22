# WO-084 · Purchase Orders page — load POs first, stop waiting on all proposals + invoices · CW Aug 05
**Change ID:** pending #1 · **Lane:** Studio platform (Finance → Purchase Orders / `#/allpos`) · **State:** OPEN · **Executor:** Claude Code (index.html ~5MB, OOMs Cursor) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html`. Grounded anchors: `renderAllPOs()` (~68693) awaits `loadFinancialData()` (~67772) / `_doLoadFinancialData`. **Build + queue in `_DEPLOY_QUEUE.md` for #1 to deploy staging. Staging first; minimal diff; targeted edits only, no wholesale load.**

## What Cindy hit
The Purchase Orders main page "takes forever to load." Her read: "it only needs to load the Studio POs first." She's right.

## Root cause (grounded)
`renderAllPOs()` blocks on `await loadFinancialData()`. That loader walks **every project (boards/*)** and, per project, fetches **proposals + invoices + purchaseOrders** (three subcollection reads each), including Completed/Archived, then `Promise.all` across all projects. The PO page does not paint until that entire firm-wide financial pull resolves. To show POs, it is loading all proposals and all invoices too, plus archived history. That is the delay.
(There is already a cache: `_cachedProjNames` / `CACHE_TTL` / `_cacheLoadingPromise`, so the SECOND visit is fast. The pain is the first load / after cache expiry / forceRefresh.)

## Change — load POs first, defer the rest
1. **Render the PO list from POs alone.** The PO page should fetch and render purchaseOrders without waiting on proposals or invoices. Proposals/invoices are not needed to show the PO table or the first page of rows.
2. **Studio / current projects first.** Load the active Studio projects' POs first and paint them; archived/completed/legacy-project POs load after (background), so the page is usable immediately. First page of results should appear as soon as the current POs are in, not after the whole history.
3. **Fill summaries after.** The top tiles (totals: open balance, bill due, variance, etc.) can compute/refresh once the fuller set arrives. Show the list first; let the totals settle a beat later rather than blocking the whole page on them.
4. **Keep pagination as-is** (`PAGE_SIZE` / `posPage` already paginate the render). This WO is about the DATA LOAD blocking first paint, not the row rendering.

## Guardrails (important — shared loader)
1. **`loadFinancialData()` is shared** by All Invoices, All Proposals, dashboard/financial-health, exports, etc. **Do not gut it or change what those pages receive.** Prefer adding a PO-first fast path (e.g. load POs, render, then kick the existing full `loadFinancialData()` in the background to populate cache + totals) over rewriting the shared loader's contract. If you do split it, every existing caller must still get the same full dataset it does today.
2. **Keep the cache behavior** (`_cachedPOs`, TTL, single-flight `_cacheLoadingPromise`). Don't trigger duplicate concurrent loads. The background full-load should reuse / populate the same cache so other pages stay fast.
3. **No data writes. No change to PO numbers, amounts, QB sync, dedupe (`dedupeGlobalCachedPOs`), or what counts as open/paid.** Load-order and render-timing only.
4. **Export still covers the full set:** `window._allPosFilteredExport` / Export XLSX must still export all POs (respecting filters), not just the first-painted current ones. Don't let "load current first" silently shrink the export.
5. Minimal diff on the 5MB file; if it balloons, stop and flag rather than rewrite the finance loader.

## Acceptance (Fable, staging screenshots + timing)
1. Open Purchase Orders on a cold load (or forceRefresh): the PO list shows current/Studio POs quickly, clearly faster than today, without waiting on all proposals/invoices.
2. Archived/legacy POs still appear (after the initial paint) and filters (project/vendor/status) still return the full set; no PO is permanently missing.
3. Totals tiles populate correctly once loaded (numbers match today's values).
4. All Invoices, All Proposals, and the dashboard financial data still load correctly (shared loader not broken).
5. Export XLSX still exports the full filtered PO set. No console errors.
Screenshots + a rough before/after load feel to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-084 · PO page performance — render from POs first (current/Studio before archived), stop blocking first paint on all proposals+invoices; keep shared loadFinancialData contract, cache, dedupe, and full export intact · Code exec (index.html OOMs Cursor) · build + queue for #1 · staging first.
