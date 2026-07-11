# WO-020 · Order Management: bring STAGING to PRODUCTION parity on Houzz exclusion (data, not code) · CW Jul 11
**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Diagnose-first.** Likely a DATA reconciliation on the staging Firestore, not a code edit — so confirm before writing data.

## What Cindy said (Jul 11, comparing prod vs staging Order Management)
"This has been fixed in production — we should fix it on staging."
- **Production** (`cch-platform.web.app`): "2248 Houzz POs hidden", OPEN POS **20 · Studio workflow POs**,
  Missing bills 2, Open PO value $69,840.72. Clean.
- **Staging** (`cch-platform-staging.web.app`): "309 Houzz POs hidden", OPEN POS **48 · Studio + 30 open
  Houzz**, Missing bills "26 · 10 Studio · 16 Houzz". Houzz leaking into the counts.
- **Both report the same code build: `20260630om32`.**

## Root cause (grounded — this is DATA, not a code bug)
Order Management's Houzz logic (`cch-order-management.js`) is intentional:
- `cchOmIsHouzzSourcePo(po)` `:48` detects Houzz origin (houzzImport / source~houzz / houzzBalance /
  `_qbIdSource='houzz-import'` / 400xxx number).
- `cchOmIsHouzzPo(po)` `:68` **hides only Houzz POs that are closed/paid/zero-balance**; comment `:66`:
  "**Open Houzz POs with a balance stay on track tabs.**" `:2020-2021` splits `houzzExcluded` (hidden) vs
  `houzzOpenIncluded` (open Houzz still counted).
So staging's "30 open Houzz" are Houzz POs whose balances aren't closed out → the code correctly keeps them
visible. Production shows none because prod's Houzz POs are all closed/paid (2248 hidden, 0 open). Same code
(om32), different DATA state: **staging's Houzz legacy data was never closed out (and staging has a smaller
Houzz set: 309 vs 2248).** That's the whole delta.

## Do this (in order)
1. **Confirm code parity first.** Diff the DEPLOYED production bundle's `cch-order-management.js` (+ any Houzz
   helper) against the staging working copy. Both claim `om32`; verify they're byte-identical for the Houzz
   logic. If production is actually running NEWER Houzz code (tag not bumped), then it IS code → deploy that
   code to staging and stop. **Report which before touching data.**
2. **If code matches (expected) → it's data.** The staging Firestore (`cch-studio-staging`) has Houzz POs (and
   likely invoices — see WO-019) that aren't marked closed/paid the way production's are. Reconcile staging's
   Houzz legacy data to production's state so closed/paid Houzz POs hide:
   - Identify the field(s) production uses to mark these closed (status / paid / balance / houzzBalance).
   - Re-run the Houzz close-out / import reconciliation on STAGING only (candidate scripts in repo root:
     `merge-houzz-legacy.js`, `import-houzz-data.js` — confirm which one production was run with), OR copy the
     corrected Houzz PO docs from the prod dataset into staging.
   - **This is a bulk write to the staging database — treat as BLOCKED-DISCUSSION: report the exact scope
     (how many docs, which fields) and get Cindy's GO before running it.** Staging Firestore is separate from
     prod, so it's safe to operate on, but a mass data write still gets a confirmation.
3. **Never touch the production database or production deploy in this WO.**

## Relationship to WO-019
WO-019 adds Houzz exclusion to the **Follow-Ups** module (which lacks it entirely — a code fix, independent
of this). WO-020 is about **Order Management's** staging-vs-prod **data** gap. Both make staging stop showing
Houzz noise; they are different mechanisms. Do WO-019 (code) regardless; WO-020 (data) after the diagnosis
above.

## Acceptance (binary)
1. Diagnosis reported: code-identical (→ data fix) or code-differs (→ deploy). Stated explicitly with evidence.
2. After the agreed fix: staging Order Management matches production's exclusion behavior — no "+ N open
   Houzz" inflating OPEN POS, Houzz hidden count reflects the real Houzz set, Missing bills shows Studio only
   (or the same split prod shows).
3. Production untouched. No code regression (Studio POs still all show).
4. If data was written to staging, the scope written matches what was reported and approved.

## Verify (Claude, staging)
Order Management on staging: OPEN POS reads "N · Studio workflow POs" with no open-Houzz suffix (matching
prod's pattern); Missing bills Houzz portion resolved. Screenshot prod vs staging side by side to
loop/verify/WO-020/.

## DONE note
loop/WO-020_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging). Note whether the fix was code or data, and
if data, the doc count + fields changed.
