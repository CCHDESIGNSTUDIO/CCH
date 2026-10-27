# FABLE DECISION — Design Services invoice expenses (FROZEN) · CW Jul 30 v1.0
Answers Docs/FABLE_PLAN_ds-invoice-expenses_CR_Jul30_v1.0.md. Locked with Cindy Jul 30. This is product law. Cursor implements only the delta from here; minimal diff; no redesign.

## Canon (Cindy)
Hours stay as hours. Expenses are product lines (item+description, qty, cost, subtotal). Pre-Paid Sales Tax only under totals. No fee summary/dump. No Terms note on invoice Print. Freeze it.

## Why it thrashed (so it stops)
Three render paths + heuristic classifiers (expenseType, TITLE REGEX, cchInvoiceLineUseServiceStyleInView, stale clientOutcomes) each decide "is this a service or an expense" differently and disagree. Every "fix" to one path re-broke another. Fix = ONE classifier, type-only, shared by all surfaces; layout frozen; STOP list; golden-reference regression lock.

## R1-R7: CONFIRMED as written in the plan, locked. Refinements:
- R2: expenses render as product lines (Item+description | Qty | Cost | Subtotal), below hours, never inside the hours grid, never as `1 hrs`.
- R5: hide the DEFAULT Terms & Notes boilerplate on invoice Print. A custom memo Cindy actually typed still shows (don't silently eat real notes). See Q4.
- R7 freeze clause stands and is enforced by the STOP list + golden reference below.

## The 4 decisions
**Q2 Classifier — TYPE ONLY. Kill the title regex.**
A line's class comes from its explicit `expenseType` (+ explicit billingCategory as the only secondary key), never from parsing the title/description. Expense-product allowlist = `expense, other_expense, shipping, handling, freight`, plus reimbursable / T&E / print-&-post / packing ONLY when tagged by an explicit billing category. Everything else = service/hours. Remove the title regex in `_isExpenseProductLine` and any title-based branch in `cchInvoiceLineUseServiceStyleInView`. This is the single biggest churn-killer.

**Q3 Surfaces — one shared CLASSIFIER, per-surface LAYOUT.**
The disagreement is in classification, not layout. Extract ONE type-only classifier used by A (DS Client View/Print), B (premium Print), and C (Manage), so a line is never "expense here, service there." R2's DS expense-table layout is owned by Surface A. B keeps its existing category tables (already product-style) but MUST obey R3 (prepaid tax to totals) and R5 (no Terms). Do NOT graft A's layout onto B, and do NOT unify the renderers now — that's a separate, larger decision.

**Q4 Memo — hide the default boilerplate only; keep a real custom memo.**
Hide the canned Terms & Notes string(s) on invoice Print/PDF. If Cindy typed a genuine per-invoice memo, it still prints. (If Cindy prefers "hide ALL memo on Print, no exceptions," that's a one-word override.)

**Q5 Ship gate.**
Prove on a STAGING-NATIVE DS invoice with hours + T&E/reimbursable + shipping/handling + prepaid tax (NOT INV-6009, prod-only). Screenshot checklist = section 6 of the plan. Then Cindy types GO for prod. No prod deploy during Vanessa's workday.

## Q6 STOP LIST for Cursor (do NOT do these without a NEW Fable decision doc)
1. No title/description regex to classify any line. Type + explicit billingCategory only.
2. No fee-summary / fee-dump card under Total Due (R4).
3. No Pre-Paid Sales Tax as a body/service/expense row — totals only (R3).
4. No default Terms & Notes boilerplate on invoice Print (R5).
5. No changes to the hours outcome layout (R1) — it is sacred.
6. No new render path, and no "unify the three renderers" refactor.
7. No Manage-side classification that leaks into Client View (doc isolation).
8. Bugfixes ONLY with file:line grounding against R1-R7, minimal diff, no redesign.

## Golden-reference regression lock (NEW — the actual anti-thrash mechanism)
Capture a known-good rendered DS invoice (the frozen staging proof) as a reference snapshot committed to the repo (HTML render + screenshot). Any future change to `cch-invoice-redesign.js` / `cch-proposals-invoices-fix.js` must diff its render of that same invoice against the reference and change NOTHING in it. If the reference render changes, the edit is rejected. This turns "don't touch it" from a hope into a check.

## Verify (Claude, staging first)
Run section-6 checklist on the staging DS invoice; capture the golden reference; screenshots before any prod GO.
