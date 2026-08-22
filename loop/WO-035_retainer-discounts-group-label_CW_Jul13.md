# WO-035 · Invoice grouped view: label the retainer/credit/discount bucket "Retainer & Discounts", not "Shipping & adjustments" · CW Jul 13
**Change ID:** pending #1 assign (INV) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. Label/grouping only. **Staging first; prod on Cindy GO.**

## What Cindy said (Jul 13, INV-6051 grouped detail view)
"I think the line should say Retainer & Discounts." The Retainer Credit line (-$2,500) groups under a section
header currently labeled **"Shipping & adjustments."** She wants that group to read **"Retainer & Discounts"**
since it holds the retainer credit / discount lines, not shipping.

## Grounding (confirmed + to complete)
- The bucket label "Shipping & adjustments" is applied when a `shipping | handling | discount` expenseType line
  has no category: `if (!String(it.category||'').trim()) category = 'Shipping & adjustments';` @index.html:26811
  (FFE invoiced report). The invoice **detail grouped render** applies the same bucket to the retainer/discount
  line — Cursor: locate that grouping site in the invoice/proposal detail render (grep the grouped-by
  room/category builder; it buckets `expenseType in (shipping, handling, discount, retainer_credit)` similarly).

## Change
- Rename the bucket so **retainer_credit and discount** lines fall under **"Retainer & Discounts"**. Keep true
  **shipping / handling** lines under a shipping label (e.g., "Shipping" or "Shipping & Handling") so the header
  is accurate to its contents. Concretely:
  - `expenseType in (discount, retainer_credit)` → group **"Retainer & Discounts"**.
  - `expenseType in (shipping, handling)` → group **"Shipping"** (or "Shipping & Handling").
  - If a group would contain a mix, split into the two labeled groups rather than one "Shipping & adjustments."
- Apply consistently everywhere the old bucket string is used (invoice detail grouped view, proposal grouped
  view, PDF, and the FFE invoiced report @26811) so the label is the same across surfaces.
- Pairs with WO-011 (retainer_credit line type) and WO-026 (the retainer line should also lose the stray
  window-treatment icon).

## Acceptance (binary)
1. On INV-6051 grouped view, the Retainer Credit line sits under a header reading **"Retainer & Discounts."**
2. A shipping/handling line groups under a shipping-labeled header, not mixed under retainer/discounts.
3. Same label in the PDF/print and proposal views; no "Shipping & adjustments" bucket holding a retainer/discount.
4. No console errors; totals unchanged.

## Verify (Claude, staging)
Open a staging invoice with a retainer credit and (separately) one with shipping → confirm each groups under the
right header. Check PDF. Screenshot to loop/verify/WO-035/.

## DONE note
loop/WO-035_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
