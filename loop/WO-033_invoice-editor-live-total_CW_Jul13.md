# WO-033 · Invoice/PO line editor: recalculate Subtotal / Tax / Total LIVE as lines change (not only on Save) · CW Jul 13
**Change ID:** pending #1 assign (INV) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. Display recalc, no schema change. **Staging first; prod on Cindy GO.**

## What Cindy said (Jul 13, editing INV-6051)
"The total didn't adjust at the bottom — it should automatically calculate as I make additions or changes."
In the line-item editor the footer read **Subtotal / Total $4,307.50** even though a Retainer Credit line of
**-$2,500** was present (true total $1,807.50). After Save, the detail view shows the correct $1,807.50. So the
**editor footer is stale until Save** — it doesn't live-recompute, and it isn't reflecting the negative credit
line while editing.

## Grounding (confirmed)
- Editor re-renders line rows via `docEditRenderItems()` (called @7659, @8341, @20272) but the footer
  Subtotal/Shipping/Tax/Total is not recomputed in that same path.
- The correct rollup already exists and is used by Save / detail / PDF: the summary builder @25816-25858
  (`subtotal`, `taxableSubtotal` via `cchInvoiceLineIsTaxable`, `tax`, `grandTotal`) and
  `invoiceLineAmountForTotals(item)` @25737 (which correctly includes negative/credit line amounts — that's why
  the saved total is right). The editor footer must call the SAME rollup on every change.

## Change
1. After every editor mutation (add item, delete item, edit qty / cost / markup / shipping / category / taxable,
   credit lines included), recompute the footer using the shared rollup (the @25816 summary), not a separate/stale
   path. Wire the recompute into `docEditRenderItems()` (or the field-change handlers that already call it) so the
   footer updates in the same tick as the row.
2. The Subtotal MUST include negative credit lines (Retainer Credit / Discount) — mirror
   `invoiceLineAmountForTotals` which already does. So adding a -$2,500 retainer immediately drops the shown total.
3. Tax = taxRate × taxableSubtotal (credits/services excluded from taxable per `cchInvoiceLineIsTaxable`); Total =
   subtotal + shipping + tax. Same numbers the Save path produces (no drift between editing and saved views).
4. Apply the same to the PO line editor footer if it shares the stale-footer behavior.

## Acceptance (binary)
1. Adding, editing, or deleting a line updates the footer Subtotal/Tax/Total immediately, before Save.
2. A negative Retainer Credit / Discount line reduces the shown total live (e.g., INV-6051 reads $1,807.50 while
   editing, not $4,307.50).
3. The editing footer and the saved detail/PDF totals always match (no drift). No console errors.

## Verify (Claude, staging)
Edit a staging invoice: add a service line (total jumps), add a -$500 discount (total drops live), change a qty
(total tracks), delete a line (total drops). Confirm the footer matches after Save. Screenshot to loop/verify/WO-033/.

## DONE note
loop/WO-033_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
