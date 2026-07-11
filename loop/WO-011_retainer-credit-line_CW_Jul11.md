# WO-011 · "Retainer Credit" line type + fix negative entry on credit lines — v1.2 · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**v1.2 supersedes v1.1.** Adds the Discount/Misc negative-entry fix Cindy hit (same root cause as the
retainer). **v1.1 recap:** KEEP Discount/Credit as a deliberate client-value tool (show all hours, then a
discount so the client feels value). Do NOT repurpose or remove `discount` — but its amount field DOES need
the negative-entry fix below.

## The problem (Cindy + Vanessa, Jul 11)
Two lines, ONE root cause. When they tried to add a retainer as a credit line, the amount field **wouldn't
accept a negative number** — Vanessa got stuck, Cindy fell back to "Record Payment" (which doesn't push to
QB, pull-only, forcing a manual QB line). Cindy then confirmed the **Discount/Misc line has the identical
bug**: "that discount Misc was the one that wouldn't let me put the negative dollar so fix that too." So the
negative-entry block is not retainer-specific — it hits every credit line, discount included.

## Grounded mechanism — two bugs, both scoped to credit lines
1. **Input block (`min="0"`).** The amount input rejects a typed negative. This is what Cindy/Vanessa hit.
2. **Math clamp.** Even when a negative is stored, two total-math paths clamp it away:
   - index.html:33582 `(c > 0) ? (c*q) : Math.max(0, (amount) - sh)`
   - index.html:40846 `(cost > 0) ? (cost*qty) : Math.max(0, sell - ship)`
   `Math.max(0, …)` floors a credit line at 0, dropping the subtraction. The correct-behavior path already
   exists at index.html:26188 `if (sell < 0) lineAmt = sell;` (comment: "credit / adjustment lines store
   negative amount with cost=0 — must subtract, not drop") and :26191 `else if (cost < 0)`. So the fix is to
   make the two clamped paths agree with :26188 for credit lines.

The `expenseType` line-type family: product, service, shipping, sales_tax, handling, expense, **discount**,
labor, other_expense, installation, design_service (index.html:13726; dropdown :35632; QB label map :36594).

## What to build

### A. Fix negative entry — SCOPED to credit line types only
Define the credit line types = **`discount` and the new `retainer_credit`** (if grounding finds another
existing credit type, include it too — but NEVER include product/service/labor/etc.).
1. **Relax `min="0"` on the amount input for credit line types only.** When the active line's `expenseType`
   is a credit type, the amount field accepts a negative (remove/override `min`, or set a negative floor).
   Normal lines KEEP `min="0"` — they must never go negative. Do NOT globally strip `min="0"`.
2. **Fix the Math.max clamp at :33582 and :40846** so a credit line's negative amount subtracts instead of
   flooring to 0. Mirror the :26188 logic (`if (sell < 0) lineAmt = sell`) in both clamped paths, gated on
   the line being a credit type / cost≤0 with a negative sell. Verify the two paths and :26188 agree.
3. Cindy types the negative directly (her muscle memory). As belt-and-suspenders, a `retainer_credit` line
   MAY coerce a positive entry to negative on blur — but the primary fix is #1/#2, and Discount must accept a
   directly-typed negative.

### B. New sibling line type `retainer_credit` (modeled on discount)
1. **Add `retainer_credit` as a new `expenseType`**, behaving like `discount` in the totals (stores negative,
   subtracts). **Discount stays a separate feature** — same negative-entry fix, but its own label + QB item.
2. **Addable from the Design rate sheet** (Add Item → Design panel) as "Retainer Credit", per Cindy, in
   addition to the line-type dropdown. Label it clearly "Retainer Credit".
3. Invoice/proposal total = lines including the negative retainer → hours − retainer = balance
   (Manno: $4,307.50 − $2,500 = $1,807.50).
4. **QB mapping (KNOWN, distinct from discount):** `retainer_credit` → Cindy's existing QB income item
   **"Other:misc income retainer payment"** (shown on INV-6051 in QBO). Its OWN qbItemRef → that item,
   distinct from discount's "Discount / Credit" (index.html:36594). Do NOT share mappings.
5. Create-once push (`runPushInvoiceToQBCore` early-returns if qbDocId set): the retainer line reaches QB
   only when added BEFORE first send/push. Already-pushed invoices (INV-6051) keep the one-time manual QB
   line — Cindy confirmed OK.
6. Booked as INCOME; non-refundable; unused = client credit for future work (disclosure per DECISIONS_LOG).

## HARD RULES
- **Discount/Credit (`expenseType:'discount'`) keeps its purpose, label ('Discount / Credit'), and QB item**
  — only its amount field gains the negative-entry fix (shared with retainer). Do not repurpose it.
- Negative entry is scoped to credit line types. Product/service/etc. keep `min="0"`.
- No native dialogs; navy/gold, no gray; never split index.html; `node --check` + tail after edit.

## Acceptance (binary)
1. On a **Discount/Credit** line, you can type a negative dollar amount directly and it sticks; the invoice
   total drops by it. (This is the exact thing that failed for Cindy.)
2. "Retainer Credit" is addable from the Design rate sheet; its amount accepts a negative (or positive
   coerced to negative); the line stores negative.
3. Invoice total drops by the retainer (hours − retainer = balance); no min="0" fight for credit types.
4. A **product/service** line still CANNOT be made negative (min="0" preserved) — regression guard.
5. Both total-math paths (:33582, :40846) subtract the credit instead of flooring to 0; agree with :26188.
6. On a NEW QB-pushed invoice, the retainer line arrives as "Other:misc income retainer payment"; a discount
   line still arrives as "Discount / Credit".
7. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
Add a Discount line with a typed negative → confirm total math and that it's accepted. Add a Retainer Credit
from the Design rate sheet → confirm total math. Try to make a product line negative → confirm it's blocked.
Screenshot all three to loop/verify/WO-011/.

## DONE note
loop/WO-011_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
