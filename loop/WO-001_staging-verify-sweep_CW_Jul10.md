# WO-001 — Staging verification sweep: RB-1 + DOC-1
**File:** WO-001_staging-verify-sweep_CW_Jul10.md · **Version:** 1.0 · **State:** OPEN
**Priority:** P0 · **Executor:** Claude (verify-only, no code change) · **Change ID:** none (no new code)
**Source:** KNOWN_ISSUES.md RB-1 (fix staged Jun 7, "awaiting Cynthia test"), DOC-1 (partial fix Jun 9, "verify on staging")

## Why
Two finished fixes have sat on staging unverified for a month. Verifying them closes two KNOWN_ISSUES rows and clears them for Cindy's production GO. This is the cheapest stability win available.

## Verify steps (staging: https://cch-platform-staging.web.app, fresh window, hard refresh)
0. Orange STAGING banner visible; browser console: zero red errors on load.
1. **RB-1** — Open Cloud-Rolling-Hills room board. Change a clip's client-selection status (e.g. Decline).
   - PASS: status saves quietly. No "🔄 New clips detected" toast, no full re-render, dropdown keeps its value, scroll position holds. Reload: status persisted.
   - Also confirm (RB-2 guard): a proposal-linked clip's explicit decline is not overwritten back to pending on next render.
2. **DOC-1** — In a test project on staging, generate a proposal from clips (item with known sku + finish in Selections); also add a line via add-from-selections.
   - PASS: new lines carry sku and finish. (Existing old lines are NOT backfilled; that is expected, not a failure.)
3. **Client portal route** — open /#/clientview/{project-slug} for the same project: renders clean, no admin controls, console clean.
4. Screenshots of each step → `loop/verify/WO-001/`.

## On PASS
Ledger → VERIFIED. Report to Cindy: RB-1 + DOC-1 ready for her own staging look and production GO (via #1 / DANGER.bat as always).

## On FAIL
Ledger → FAILED with evidence; open a revision work order for Cursor with the failing step + console output.

**Attempts:** 0 of 3
