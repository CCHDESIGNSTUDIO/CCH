# WO-038 · Invoice format: show retainer/credit as a deduction line BELOW the subtotal (work subtotal → retainer → total), not a grid line item · CW Jul 13
**Change ID:** pending #1 assign (INV) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html` (+ PDF + client view). **Staging first; prod on Cindy GO.** Supersedes WO-035 for retainer/discount.

## What Cindy said (Jul 13, INV-6051)
"It should have had the time total, and then a line under the subtotal for the retainer, and then the total."
Desired invoice format:
```
Subtotal (work / time)      $4,307.50
Retainer credit            -$2,500.00
Total                       $1,807.50
```
Right now the retainer is a **grid line item** (buried in LINE ITEMS under "Shipping & adjustments"), and it's
folded INTO the subtotal, so the subtotal reads $1,807.50 instead of the $4,307.50 of actual work.

## Grounding (confirmed)
- `invoiceTotalsBreakdown(inv, projData)` @index.html:26717 sums **every** line into `subtotal` (@26731-26737),
  including the negative `retainer_credit` line → subtotal comes out $1,807.50. `grandTotal = subtotal + shipping
  + tax` (@26745).
- Credit line types = `cchInvoiceLineIsCreditType(item)` @26627 (`discount` || `retainer_credit`); retainer
  amount is forced negative (@26655, :36332).
- Totals are rendered in several places off this breakdown: the detail **right rail** (Merchandise subtotal /
  Sales tax / Shipping / Total / Balance due), the **bottom totals** (Subtotal / Shipping / Tax / Total), the
  **PDF/print**, the **client view**, and the **editor footer** (WO-033).

## Change
1. **Split the rollup** in `invoiceTotalsBreakdown`: exclude credit-type lines (`cchInvoiceLineIsCreditType`)
   from `subtotal`; sum them into a new **`credits`** array (by type/label + amount) and a `creditTotal`.
   - `subtotal` = sum of non-credit lines (the work/time) = $4,307.50.
   - `creditTotal` = sum of retainer_credit + discount lines = -$2,500.
   - `grandTotal = subtotal + totalShipping + tax + creditTotal` = **$1,807.50 (unchanged value)**.
   - Tax still computed on taxable non-credit lines only (unchanged).
2. **Totals block display** (rail + bottom + PDF + client view): render, in order — Subtotal, Shipping (if any),
   Tax (if any), then **one deduction row per credit** (label from the line: "Retainer credit", "Discount"),
   shown as a negative, then **Total**, then Balance due. So the retainer sits between subtotal and total.
3. **Remove credit lines from the LINE ITEMS grid** — retainer_credit / discount no longer render as grid rows
   (they live in the totals block now). This also empties the "Shipping & adjustments" grid bucket for them, so
   **WO-035's relabel is superseded for retainer/discount** (if genuine shipping/handling grid lines remain,
   they keep their own grouping; those are not credits).
4. Keep the multi-line case working: if there are two retainer lines or a retainer + a discount, show each as its
   own deduction row (or sum per label). `Lines` count and stored data unchanged — this is display only.
5. **Editor footer (WO-033)** shows the same split live: Subtotal (work), retainer deduction, Total.

## STATUS (Jul 13) — Studio detail DONE, client PDF still pending
The Studio Manage/detail view shipped correctly (Subtotal $4,307.50 → Retainer Credit -$2,500 → Total $1,807.50).
**Still to do: the client-facing invoice PDF** — the redesigned client invoice is **`cch-invoice-redesign.js`
(build ds10; "Total Due" grand @:349)**, a separate module that did NOT get the split. It currently folds the
retainer into the design-services line and prints "Design Services · 40 hours — $1,807.50", i.e. it shows the NET
as the hours amount, understating the work (40 hrs of work = $4,307.50) and hiding the retainer. Apply the same
treatment there: show the **work/hours subtotal ($4,307.50)**, then a **Retainer Credit deduction (-$2,500.00)**,
then **Total Due ($1,807.50)**. Showing the client the credit is a feature, not a leak.

## Unaffected
- **QB mapping (WO-034):** regardless of display, the retainer still maps to QB as the negative "Other:misc
  income retainer payment" line so the QB invoice total reconciles to $1,807.50. Presentation here doesn't change
  the QB push.
- Stored line data unchanged (retainer is still a `retainer_credit` line in `items[]`); only rendering + the
  rollup split change.

## Acceptance (binary)
1. INV-6051 detail shows Subtotal **$4,307.50**, a **Retainer credit -$2,500.00** row beneath it, Total
   **$1,807.50**, Balance due $1,807.50. The retainer is NOT a row in the LINE ITEMS grid.
2. Same format in the bottom totals, the PDF/print, and the client view; editor footer matches live.
3. Grand total and balance are unchanged in value ($1,807.50). Tax unaffected. No "Shipping & adjustments" bucket
   holding the retainer.
4. Multi-credit (retainer + discount) each show as their own deduction row. No console errors.

## Verify (Claude, staging)
Open a staging invoice with a retainer credit → confirm the subtotal is the work total, the retainer shows as a
deduction under it, and the total is correct, across detail / PDF / client view / editor. Screenshot to
loop/verify/WO-038/.

## DONE note
loop/WO-038_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
