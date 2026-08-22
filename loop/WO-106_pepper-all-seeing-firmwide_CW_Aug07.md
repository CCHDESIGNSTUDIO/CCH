# WO-106 — Pepper all-seeing: firm-wide awareness across every project and module

**CW_Aug07** · Lane: **Cursor** (staff Pepper + Functions) · The SEE-everything foundation (plan Pillar 1) under WO-105 (staff brief), the priorities ranking, and the follow-up loops. (WO-102/103 held for Pepper Desktop.)

## Goal
Pepper sees **everything, firm-wide** — not just the project that's open. Complete cross-project awareness across **proposals, invoices, purchase orders, Builder work orders, tasks, and decisions** (plus time). This is what makes her follow-up complete instead of partial.

## Scope — all projects (`boards`) × all modules
- **Proposals** — status (draft / sent / approved / declined) + $, per project + firm.
- **Invoices** — status (draft / sent / paid / open AR) + $ + age.
- **Purchase Orders** — status (missing confirmation / ETA / received / billed); reuse Order Management's firm-wide aggregation (`cchOm*` / `buildOmDigest`).
- **Builder work orders** — `boards/{id}/workOrders` (grounded: `builder/index.html:6277, 9857`; firm-wide loop already at `index.html:17233`), status (created / saved / revised) + project + room.
- **Tasks** — `boards/{id}/tasks` (grounded, WO-100 / `buildFirmTasksDigest`), open / overdue.
- **Decisions** — `boards/{id}/clientDecisions` (grounded, `buildDecisionsDigest` / `cpPortalCollectOpenDecisionItems`), open / awaiting.
- **Client activity** — what clients actually *did*, per project: viewed a board, starred an item, opened / commented on a proposal, approved / declined, opened an invoice, or went quiet. Grounds in the client-sourced `activity` entries (`cch-client-activity.js` / `caFetchProjectActivity`, the "Client activity" count). This is a **staff signal** (Cindy + Vanessa see what clients are up to), never client-facing.
- **Time** — unlogged (Timely / Reconciliation) + unbilled (`timeEntries`), firm-wide per member (WO-105).

## Build approach (read a rollup — do NOT hammer Firestore)
- **Extend the existing `_cache/financialSummary` rollup** (written by `rebuildFinancialSummary` @`Functions/index.js:4014`, read @`index.html:47572`) into a complete firm-wide **"state of everything"** cache: per-project + firm totals for proposals / invoices / POs / workOrders / tasks / decisions / time, each bucketed by status. Pepper reads **this one doc**, not 300 project queries.
- Refresh on the existing **"🔄 Refresh Data"** action (`index.html:47560`) + on a schedule, and ideally on write.
- Fallback for anything not in the cache: bounded scoped queries — never an unbounded firm-wide sweep per greeting.

## Staff-only / internal
Pepper's omniscience is for Cindy + Vanessa. POs, Builder, tasks, and internal decisions are **internal** (never client-facing per `CCH_STANDING_RULE_client-visibility-boundary`). Never renders on any `#/clientview/*` route.

## Accuracy — non-negotiable (same rule as WO-104 / WO-105)
The rollup is the source of truth; it must be current and exact, and Pepper states when it was last refreshed if not live. Every count / $ matches each module's own firm-wide page. Never invents; if the cache is stale or a bucket can't load, she says so.

## Feeds
Powers **WO-105** (staff brief), the **Pillar 2 priorities ranking**, and the **PO + client follow-up loops**. Generalizes **WO-100** (per-project tasks) to firm-wide across every module.

## Acceptance
1. Staff asks a firm-wide question — "where do we stand everywhere," "what proposals are unsent," "which POs are missing ETAs," "what Builder orders are open," "what tasks and decisions are open across projects" — and Pepper answers from the **complete cross-project view**, not just the open project.
2. Every count / $ matches the module's own firm-wide page.
3. Builder work orders, tasks, and decisions are all included and attributed to project (+ room where relevant).
4. Performant (reads the cache rollup, not hundreds of live queries). Staff-only, never client routes. Verified on staging, then prod on Cindy's GO.
