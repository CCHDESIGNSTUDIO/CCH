# WO-023 · Time views: add a "Pending only" status filter on the Financials / logged-time pages · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Small UI add. No data change. Grounding-first (confirm the exact list + existing filter).

## What Cindy asked (Jul 11, on the Financials time list)
"Can I get an option on the Timely logged pages to only see pending?" On `#/financials` the time entries are
grouped by date with a STATUS of **Pending** (orange) or **Logged** (green). She wants to filter to **Pending
only** so she can work the pile that still needs attention (assign a real service / make billable) — the exact
triage view for the untagged-time recovery.

## Grounding (verified this session; re-confirm)
- `renderFinancials()` `index.html:43019` renders the Financials page (route `#/financials`, :4707).
- The per-entry status renders as Pending vs Logged (Pending pill e.g. `index.html:13892`).
- A **status-filter pattern already exists** — the Time Ledger's "All Status" dropdown (`index.html:46994`
  "All Status", and the generic list status filter at :5309 `…FilterStatus=this.value…`). REUSE it; don't
  invent a new control.
- Confirm whether the list Cindy is viewing is inside `renderFinancials` or the shared Time Ledger renderer,
  and put the filter on the one she screenshotted (Financials). If both share a renderer, one change covers both.

## IMPORTANT (Cindy, Jul 11): this is a VIEW filter, not a selection
"I don't want to *select* all pending, I just want to *view* all pending." So this is a **display/filter
control that hides non-matching rows** — it must NOT check/select the entries or trigger any bulk action. No
"select all pending" checkbox behavior. Just filter what's shown.

## ALSO add a safety guard (Cindy accidentally logged all entries without reviewing)
Add a **confirmation step before any bulk log / create-invoice action**: "You're about to log/invoice N
entries — review first?" with a cancel. A bulk action must never fire on unreviewed rows. Do NOT default any
"select all" to checked. (Optional but recommended: a bulk **"revert selected to Pending"** action so
mistakenly-logged entries can be undone in one step — spec it if cheap; otherwise per-entry Edit → set status
Pending is the fallback.)

## Change
Add a **Status filter** to the Financials time-entries list with options **All · Pending · Logged** (default
All), defaulting the control to reuse the existing status-filter mechanism. Selecting **Pending** shows only
entries whose status is Pending (not yet logged/finalized); **Logged** shows only Logged. Persist the choice
for the session (same pattern as the other list filters). If the Time Ledger page lacks the same option,
add it there too for consistency.

## Acceptance (binary)
1. On `#/financials`, a Status filter is present; choosing "Pending" shows only Pending entries, "Logged" only
   Logged, "All" everything.
2. The per-day grouping/totals recompute to the filtered set (no stale counts).
3. Matches the existing filter styling; no console errors; `node --check` passes, tail intact.

## Verify (Claude, staging)
Financials: toggle Status → Pending, confirm only Pending rows show and totals update; screenshot to
loop/verify/WO-023/.

## DONE note
loop/WO-023_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
