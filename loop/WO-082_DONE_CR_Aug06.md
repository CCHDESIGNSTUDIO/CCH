# WO-082 DONE — Time Ledger selection + scroll preserve · #1 Cursor · Aug 06

**State:** DONE-UNVERIFIED · **Verifier:** Fable · **Staging:** with v9.9.93

## Root cause (grounded)

Selection lived only in DOM `.time-cb:checked`. `tlSetAddedHrs` / `saveTimeEntry` / inline `added` call `renderTimeView()` / `renderTimeTracker()`, which rebuild the table and wipe checks + scroll (`.time-ledger-wrap` overflow).

`clearTimeLedgerSelection` / `selectUninvoicedBillableOnPage` were **called from the toolbar but never defined** in `index.html` (dead onclick).

## Files touched

| Location | Change |
|----------|--------|
| `renderTimeView` ~51864 | Capture scroll → render → prune Set to filtered → re-apply checks → restore scroll |
| `updateTimeSelectionInfo` | Counts from `_tlSelectedEntryIds` + `timeEntries` |
| List + month ledger checkboxes | `onchange="tlTimeCbChanged(this)"` |
| ~57718+ | Set helpers, Clear / Select uninvoiced, toggleAll syncs Set |
| `showCreateInvoiceFromTime` / `bulkDeleteSelectedTime` | Prefer Set over DOM |
| `CCH_BUILD` | `9.9.93` / `wo082-tl-selection-scroll-2026-08-06` |

## Guardrails

No hours / billable / rate / invoice-creation logic changes — selection + scroll only.

## Fable verify (staging)

1. Filter April, multi-select, +hrs + note on one row → others stay checked; bulk bar count matches.
2. Edit modal save → selection kept.
3. Long list: edit near bottom → no jump to top.
4. Clear / Select uninvoiced / select-all still work; no console errors.
