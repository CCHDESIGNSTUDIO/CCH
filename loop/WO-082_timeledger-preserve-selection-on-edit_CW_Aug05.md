# WO-082 · Time Ledger — keep row selection when you edit a row · CW Aug 05
**Change ID:** pending #1 · **Lane:** Studio platform (Smart Time → Time Ledger) · **State:** OPEN · **Executor:** Claude Code (index.html ~5MB, OOMs Cursor) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html` — the Time Ledger tab (the table with per-row checkboxes; bulk bar with Delete Selected / Select uninvoiced / Clear selection / Consolidate 15min & Under / Create Invoice; the inline `+hrs` / bill-hours override; the row Edit modal). **Build + queue in `_DEPLOY_QUEUE.md` for #1 to deploy staging. Staging first; minimal diff; targeted edits only, no wholesale load.**

## What Cindy hit
On the Time Ledger she filtered to April, checked multiple entries, then used the inline field to add hours and a note to one row. Saving that edit **cleared every checkbox** (whole selection lost). She then has to re-select all of April. Editing one row must not wipe the selection of the others.

## Root cause (confirm on grounding)
Selection is held in the rendered DOM (the checkbox `checked` state), not in a persistent structure. Any inline `+hrs`/bill-hours save or Edit-modal save re-renders the table, rebuilds the rows fresh, and the checked state is lost. Same re-render likely also resets scroll position and the "N selected" bulk-bar counts.

## Change
1. **Hold selection in a persistent Set of entry ids** (survives re-render), not in DOM checkbox state alone.
2. **Re-apply the checked state after any re-render** — after an inline `+hrs`/bill-hours save, after an Edit-modal save, after sort/scroll. Rows still present stay checked; a row that legitimately left the view (filter change) drops out of the Set.
3. **Editing a single row must not clear the rest of the selection.** Only that row's data changes; the selection Set is untouched.
4. **Keep the bulk bar in sync** with the persisted Set ("Create Invoice (N uninvoiced in view)", Delete Selected, Consolidate) so counts stay correct after an edit.
5. **REQUIRED (not optional): preserve scroll position on save.** Every inline `+hrs`/bill-hours save and every Edit-modal save currently jumps the view back to the top of the ledger. Cindy confirmed this is a real problem, not cosmetic: on a 126-entry ledger she loses her place on every single edit. After a save, the view must stay exactly where she was. Prefer updating just the edited row in place over re-rendering the whole table; if a full re-render is unavoidable, capture and restore scrollTop so there is no jump.

## Guardrails
1. **Do not change any hours, billable, rate, or amount logic.** The `+hrs` / bill-hours override (log 1:00, bill 3:00) must behave exactly as today. This is selection-state only.
2. **Do not change what gets invoiced or how.** Create Invoice must still act on the same entries it does now, just with the selection correctly preserved.
3. No pricing writes; no change to the entry data model. Minimal diff on the 5MB file; if it balloons, stop and flag rather than rewrite the ledger.
4. Clear selection / Select uninvoiced / select-all header box keep working as today.

## Acceptance (Fable, staging screenshots)
1. Filter to April, check several entries, add `+hrs` and a note to one row, save: the other checkboxes stay checked, and the edited row shows the new hours/note.
2. The bulk-bar count (e.g. "Create Invoice (N uninvoiced)") matches the still-selected rows after the edit.
3. Editing via the row Edit modal also preserves the selection.
4. **After a save (inline or modal), the view stays at the same scroll position, no jump to the top.** Test on a long list (100+ rows) by editing a row near the bottom.
5. Clear selection, Select uninvoiced, and select-all still behave correctly; no console errors.
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-082 · Time Ledger — persist multi-row selection AND scroll position across inline `+hrs`/Edit saves (selection Set + no jump-to-top; no hours/invoice logic change) · Code exec (index.html OOMs Cursor) · build + queue for #1 · staging first.
