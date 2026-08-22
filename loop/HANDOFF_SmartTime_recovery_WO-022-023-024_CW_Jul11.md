# HANDOFF → Cursor · BUILD the Smart Time time-recovery cluster: WO-022 + WO-023 + WO-024 · CW Jul 11
**From:** Fable (Cowork) · **Action:** build all three, deploy to **staging** for Cindy's review. **Do NOT touch production. Do NOT run any resync yourself.** Priority: high (Cindy directed).

## Why (one goal)
Stop losing tracked time and recover what's been lost. Timely tracked the work but untagged / pre-integration
entries never reached the ledger (Feb 2 = ~8h logged as 0; Feb 9 = 4h39m untagged, $0). These three orders
fix capture, review, and reach. Grounding-first on 22 and 24 — the import path and the resync floor aren't
grounded in the specs; map them and report before changing.

## Build order + what each is
1. **WO-024 first — Timely resync reaches February.** Root cause grounded: `syncTimelyNow()` **index.html:14345**
   uses a 120-day window (→ ~Mar 13 from Jul 11), so Feb never pulls. Make the start date settable/reach the
   full year; **verify the `timelySyncEntries` Cloud Function (`Functions/`) doesn't clamp server-side** and
   report. Idempotent (no dupes on re-sync). Unblocks everything else.
   - **NOTE:** the sync function writes to the **production data project (`cch-design-boards`)**, not staging.
     Ship the CODE fix to staging for review. **Running the actual February resync is Cindy's action with her
     explicit GO — Cursor does not trigger it.**
2. **WO-022 — capture untagged Timely time; assign at log time.** Never drop an entry for missing tag / service
   / rate; surface untagged + pre-integration ($0) entries in the **Reconciliation** queue; assign
   **Project + Service per entry** (multi-project days split); **service is optional on save** (blank → Pending,
   $0 until assigned; assigning applies the rate). Preserve Timely's app breakdown as the description.
   Grounding-first: find the current import path and where entries are dropped; report.
3. **WO-023 — Pending VIEW filter + safety guard.** Add a Status filter (All/Pending/Logged) on the Financials
   time list — **a display filter, NOT a select-all** (Cindy accidentally logged everything). Add a
   **confirm-before-bulk-log/invoice** step; optional one-click **"revert selected to Pending"** for undo.
   Reuse the existing status-filter pattern (`index.html:5309`/`:46994`).

## Constraints (binding)
- Staging only; production untouched; no resync run by Cursor.
- Vanessa permission rules stand (no profit exposure). Never split index.html; `node --check` + verify tail;
  navy/gold, no gray, no native dialogs (use the platform's confirm modal for the guard).

## After deploy
Post the standard `_DEPLOY_QUEUE.md` staging line and tell Cindy the Smart Time cluster is on staging to
review (Financials Pending filter + Reconciliation assign queue + the extended sync date). Claude (Cowork)
verifies. Then Cindy runs the February resync herself and starts clearing the Pending pile.

## DONE note
`loop/WO-022_DONE`, `WO-023_DONE`, `WO-024_DONE` (CR, staging) + `_DEPLOY_QUEUE.md` lines. WO-024 DONE must
state the cloud-function finding (client-only vs server floor) and dedup behavior.
