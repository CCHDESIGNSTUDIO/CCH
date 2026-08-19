# CCH Studio Loop Protocol
**File:** loop/LOOP_PROTOCOL_CW_Jul10_v1.1.md · **Version:** 1.1 · **Status:** ACTIVE

## Revision history
- v1.0 (Jul 10, CW): Draft, delivered to Cindy for review.
- v1.1 (Jul 10, CW): Installed on Cindy's GO. Reworked to plug into the existing `_DEPLOY_QUEUE.md` / Deploy Master #1 pipeline instead of a parallel deploy lane. Work orders now carry BF-###/FT-### change IDs from `Docs/CHANGE_REGISTER.md`.

---

## Purpose

Replace Cindy-as-relay. Claude (Cowork) discovers, designs, and verifies; Cursor executes; Deploy Master #1 deploys per its existing hourly queue; Cindy makes decisions and gives the production GO. Nobody pastes context between agents; the repo is the bus.

## The cycle

```
DISCOVER (Claude, from KNOWN_ISSUES / CURRENT_PRIORITIES / _DEPLOY_QUEUE / trackers)
 → WORK ORDER (Claude writes loop/WO-###_*.md, ledger row OPEN)
 → EXECUTE (Cursor session takes oldest OPEN, grounds it itself, edits, writes DONE note,
            appends the standard one-line handoff to _DEPLOY_QUEUE.md — STATUS: pending)
 → DEPLOY (Deploy Master #1 ships the staging batch, exactly as today)
 → VERIFY (Claude runs the order's verify steps on cch-platform-staging.web.app,
           evidence into loop/verify/, ledger → VERIFIED or FAILED)
 → ITERATE (FAILED → WO revision v1.x, back to OPEN; max 3 attempts, then BLOCKED-DISCUSSION)
 → STOP (cycle report to Cindy; production stays: Cindy typed GO + DANGER.bat, never an agent)
```

## Files

- `loop/LOOP_LEDGER.md` — single status table. States: OPEN → IN PROGRESS → DONE-UNVERIFIED → VERIFIED / FAILED → PROD (Cindy only). Plus BLOCKED-DECISION / BLOCKED-DISCUSSION.
- `loop/WO-###_<slug>_CW_[MonDD].md` — work orders (Claude). Grounded diagnosis with file:line, change requested, binding constraints, numbered binary acceptance criteria, verify steps, rollback, attempt count, BF/FT id.
- **Lane suffix (optional):** `WO-###-B_*.md` / ledger id `###-B` = **Custom Order Builder** (`platform/builder/`). Use so Builder work is obvious next to Studio platform WOs. Other lanes may get letter suffixes later if needed.
- `loop/WO-###_DONE_CR_[MonDD].md` — completion notes (Cursor). Files touched, what changed (file:line), self-test, queue line appended yes/no. Cursor never sets VERIFIED and never deploys or commits (commit-deploy-policy.mdc governs).
- `loop/verify/` — Claude's verification evidence (screenshots, console output).

## Boundaries unchanged

STOP-READ-FIRST.md, CLAUDE.md Machine-1 rules, CODE_GROUNDING_PROTOCOL, nightly session logs, handoff-folder copies, `_DEPLOY_QUEUE.md` as the only deploy intake, `Docs/CHANGE_REGISTER.md` numbering. A work order's inherited diagnosis is a lead, not evidence: the executing session re-greps before editing.
