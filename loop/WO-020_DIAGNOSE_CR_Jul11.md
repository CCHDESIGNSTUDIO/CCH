# WO-020 · Order Management Houzz staging parity — DIAGNOSE REPORT · CR Jul 11
**State:** BLOCKED-DISCUSSION (awaiting Cindy GO before any staging Firestore writes)  
**Executor:** Cursor · **Verifier:** Claude (Cowork)

## Summary
**Code is identical across production, staging, and the local working copy.** The staging vs production Order Management delta is a **data state gap**, not a code bug. No production deploy or production database access was performed.

## 1. Code parity (confirmed)

| Source | `OM_BUILD` | SHA-256 match |
|--------|------------|---------------|
| Production (`cch-platform.web.app/cch-order-management.js`) | `20260630om32` | baseline |
| Staging (`cch-platform-staging.web.app/cch-order-management.js`) | `20260630om32` | **identical to prod** |
| Local (`platform/cch-order-management.js`) | `20260630om32` | **identical to staging** |

Houzz logic is unchanged and intentional (`cch-order-management.js:48–80`):
- `cchOmIsHouzzSourcePo` — detects Houzz origin
- `cchOmIsHouzzPo` — hides Houzz POs only when **closed/paid/zero-balance**
- **Open Houzz POs with a balance remain visible** (comment at `:66`)

Production shows **0 open Houzz** because prod's Houzz PO set is fully closed/paid (2248 hidden). Staging shows **30 open Houzz** because staging Firestore still has Houzz POs with open balances that were never reconciled to closed/paid.

**Conclusion:** Deploying newer code will not fix staging OM counts. A **staging-only data reconciliation** is required.

## 2. Observed UI delta (Cindy, Jul 11)

| Metric | Production | Staging |
|--------|------------|---------|
| Houzz POs hidden | 2248 | 309 |
| OPEN POS | 20 · Studio workflow POs | 48 · Studio + **30 open Houzz** |
| Missing bills | 2 | 26 · 10 Studio · **16 Houzz** |

Same build tag on both hosts (`om32`); different Firestore document states.

## 3. Proposed staging data fix (BLOCKED — needs Cindy GO)

**Scope:** `cch-studio-staging` Firestore only. **Never** touch `cch-design-boards` (production).

**Goal:** Mark closed/paid Houzz legacy POs on staging the same way production does, so `cchOmIsHouzzPo` hides them and OPEN POS reads like prod ("N · Studio workflow POs" with no open-Houzz suffix).

**Candidate approach:**
1. Run a **read-only dry-run** first using logic from `_scripts/dryrun-om-missing-bills-houzz_BY_CLAUDE_2026-05-19.js` (adapted for staging credentials).
2. For each Houzz-sourced PO where production-equivalent close-out applies (`!isOpen` OR zero balance OR paid status), set the same fields production uses: `status`, `paymentStatus`, `paidAmount` / `payments`, `houzzBalance`, etc.
3. Alternative: re-run `merge-houzz-legacy.js` or `import-houzz-data.js` against staging only — **confirm which script production used** before executing.

**Estimated scope (from UI, not yet dry-run verified):**
- ~30 open Houzz POs inflating OPEN POS
- ~16 Houzz rows in Missing bills
- Smaller Houzz hidden set on staging (309 vs 2248) suggests staging never received the full prod close-out pass

**Service account note:** The dry-run script expects `_debug/service-account.json/cch-design-boards-firebase-adminsdk-*.json` (prod). A **staging** service account key is needed for an accurate doc-level count before write. Without it, this report relies on live UI counts + code parity.

## 4. Relationship to WO-019 (shipped separately)

WO-019 adds Houzz exclusion to **Follow-Ups** (code fix, `fu6`, staging deploy). That is independent of OM's intentional "open Houzz with balance stays visible" behavior. Both reduce Houzz noise on staging; different modules.

## 5. Next step — awaiting Cindy GO

| Action | Status |
|--------|--------|
| Code deploy to staging for OM | **Not needed** (already om32, byte-identical) |
| Staging Firestore bulk write | **BLOCKED** — report scope + get GO |
| Production | **Untouched** |

When Cindy approves, run dry-run against `cch-studio-staging`, report exact doc count + field changes, then execute staging write only.
