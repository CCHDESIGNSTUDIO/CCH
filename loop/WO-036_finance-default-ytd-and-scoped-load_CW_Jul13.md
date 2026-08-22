# WO-036 · Invoices / POs / Proposals load too slow — default to YTD (with an "All" option) and scope the load · CW Jul 13
**Change ID:** pending #1 assign (PERF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod only in the quiet window on Cindy GO.** Vanessa-facing daily pain.

## What Cindy said (Jul 13)
"Everything loads way too slow. Invoices, POs. Can it just load YTD, and then we have the option for all."

## Grounding (confirmed)
- The financial pages load **everything up front**: `_doLoadFinancialData` @index.html:62402 loops **every**
  live-financial project and `.get()`s the **entire** proposals / invoices / purchaseOrders subcollections (plus
  clips for Houzz PO reconstruction) with **no date scoping or limit** (@62424-62463). Cached for CACHE_TTL, but
  the first load per window pulls years of Houzz history across ~60 projects. That's the slowness.
- The period toggle is **client-side only**: `_finPeriodFilter` @62609 filters the already-loaded arrays by date;
  default is **`'all'`** (`_finTimePeriod[page] || 'all'` @62610, @62632). Toggle UI `_finPeriodToggle` @62627
  offers Week / Month / **YTD** / All (labels @62629). Date parse is tolerant: `item.date || dueDate || createdAt`,
  undated items are kept (@62622-62624).

## Two levers — ship A now, measure then decide B
### A. Default the view to YTD (quick, low-risk — do first)
Set the default period for **pos, invoices, proposals** to **`'ytd'`** instead of `'all'` (initialize
`_finTimePeriod` with these, or change the fallback for these pages). The "All" (All Time) button already exists
in the toggle, so Cindy/Vanessa get the full set on one click. This cuts the rendered row count (and the DOM /
pagination work) immediately, and makes the summary strips reflect YTD by default.
- **Flag for Cindy:** the firm-wide PO tiles (WO-027) and invoice/proposal totals compute over the
  period-filtered set, so they'll read **YTD by default** with All available. That's the intended behavior; just
  confirm the headline numbers now say "YTD" clearly (the toggle shows which period is active).

### B. Scope the LOAD, not just the view (real fetch win — measure first)
Defaulting the view helps render but `_doLoadFinancialData` still fetches everything. To actually load faster:
1. **Measure first** (report before building): is the slowness fetch-bound (network/Firestore, the 60-project
   parallel `.get()`s) or render-bound (painting thousands of rows)? Time both on a real dataset. If render-bound,
   A alone may be enough and B is optional.
2. If fetch-bound, load **YTD-first**: fetch only current-year docs on initial load, render, then a **"Load all
   history"** button triggers the full fetch (current `_doLoadFinancialData`) on demand.
   - **Date-format caution:** legacy Houzz docs have inconsistent date fields (string vs timestamp vs missing).
     A server-side `.where(dateField,'>=',yearStart)` will silently DROP docs whose date field is absent or
     wrong-typed. Do NOT ship a scoped query that hides legacy invoices/POs. Options: (a) `.orderBy(date desc)
     .limit(N)` for a fast recent slice + "Load all" for the tail, only if the date field is reliably present;
     or (b) keep the full fetch but cache harder and show YTD instantly while the rest streams in. Pick based on
     the measurement; report what the date fields actually look like across projects.
3. Keep the existing cache (CACHE_TTL) so navigation stays instant after the first load.

## Acceptance (binary)
1. Opening Invoices, POs, and Proposals defaults to **YTD** with the YTD toggle active; "All Time" shows
   everything in one click; nothing is permanently hidden.
2. Perceptibly faster first paint on the financial pages (fewer rows rendered by default).
3. If B is implemented: initial load fetches only YTD (or a bounded recent slice); "Load all history" fetches the
   rest; **no legacy invoice/PO is dropped** from the All view (verify counts match the old full load).
4. Summary tiles clearly label the active period; totals reconcile within the shown period. No console errors.

## Verify (Claude, staging)
Load Invoices / POs on staging: confirm YTD default + fast paint, toggle to All (full set returns, counts match
the prior full load), confirm no dropped legacy docs. If B shipped, confirm "Load all history" and measure the
before/after load time. Screenshot to loop/verify/WO-036/.

## DONE note
loop/WO-036_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
