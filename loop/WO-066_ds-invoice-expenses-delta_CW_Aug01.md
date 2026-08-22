# WO-066 · Design Services invoice expenses: implement the frozen delta · CW Aug 01
**Change ID:** pending #1 assign (DS-INVOICE) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Fable/Claude
Full decision doc: `claude/FABLE_DECISION_ds-invoice-expenses_CW_Jul30_v1.0.md` (LOCKED with Cindy Jul 30). This WO exists so the frozen decision has a repo-side work order Cursor's queue can pick up; read the source doc in full before touching code, this file is the routing summary only.

## Why it thrashed (so it stops)
Three render paths + heuristic classifiers (`expenseType`, title regex, `cchInvoiceLineUseServiceStyleInView`, stale `clientOutcomes`) each independently decide "service or expense" and disagree. Every prior fix to one path re-broke another.

## Canon (Cindy, frozen)
Hours stay as hours. Expenses are product lines (item+description, qty, cost, subtotal). Pre-Paid Sales Tax only under totals. No fee-summary/dump. No default Terms note on invoice Print. Freeze it.

## The delta to build
1. **Classifier (Q2): TYPE ONLY.** Kill the title regex. A line's class comes from explicit `expenseType` (+ explicit `billingCategory` as the only secondary key), never from parsing title/description. Expense-product allowlist: `expense, other_expense, shipping, handling, freight`, plus reimbursable / T&E / print-&-post / packing ONLY when tagged by an explicit billing category. Everything else = service/hours. Remove the title regex in `_isExpenseProductLine` and any title-based branch in `cchInvoiceLineUseServiceStyleInView`.
2. **Surfaces (Q3): one shared classifier, per-surface layout.** Extract ONE type-only classifier used by Surface A (DS Client View/Print), B (premium Print), C (Manage). R2's DS expense-table layout belongs to Surface A only. Surface B keeps its existing category tables but MUST obey R3 (prepaid tax to totals) and R5 (no Terms). Do not graft A's layout onto B. Do not unify the three renderers, that is a separate, larger decision, explicitly out of scope.
3. **Memo (Q4):** hide the canned Terms & Notes boilerplate on invoice Print/PDF. A genuine per-invoice memo Cindy actually typed still prints.
4. **Ship gate (Q5):** prove on a STAGING-NATIVE DS invoice (not INV-6009, that one is prod-only) with hours + T&E/reimbursable + shipping/handling + prepaid tax. Screenshot checklist = section 6 of the source decision doc. Cindy types GO before prod. No prod deploy during Vanessa's workday.

## STOP LIST (Q6) — hard constraints, do NOT do these without a NEW Fable decision doc
1. No title/description regex to classify any line. Type + explicit `billingCategory` only.
2. No fee-summary / fee-dump card under Total Due (R4).
3. No Pre-Paid Sales Tax as a body/service/expense row, totals only (R3).
4. No default Terms & Notes boilerplate on invoice Print (R5).
5. No changes to the hours outcome layout (R1), it is sacred.
6. No new render path, and no "unify the three renderers" refactor.
7. No Manage-side classification leaking into Client View (doc isolation).
8. Bugfixes ONLY with file:line grounding against R1-R7, minimal diff, no redesign.

## Golden-reference regression lock (the actual anti-thrash mechanism)
Capture the known-good rendered DS invoice (the frozen staging proof) as a reference snapshot (HTML render + screenshot) committed to the repo. Any future change to `cch-invoice-redesign.js` / `cch-proposals-invoices-fix.js` must diff its render of that same invoice against the reference and change NOTHING in it. If the reference render changes, reject the edit.

## Constraint
Standing pricing rule applies (`claude/CCH_STANDING_RULE_saved-proposal-pricing_CW_Jul31.md`): no price/cost/markup writes to any saved proposal or room-board clip as part of this work.

## Verify (Fable, staging first)
Run the source doc's section-6 checklist on the staging DS invoice, capture the golden reference, screenshots before any prod GO.

## DONE note
`loop/WO-066_DONE_CR_[MonDD].md`.
