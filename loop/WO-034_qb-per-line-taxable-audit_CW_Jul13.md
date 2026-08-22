# WO-034 · QuickBooks sync is marking some fees/services Taxable — audit + fix how EACH line's tax status is sent · CW Jul 13
**Change ID:** pending #1 assign (QB) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html` + the QB push **cloud function**. **GROUNDING/AUDIT FIRST — report before changing.** Prod QB behavior = Cindy GO.

## What Cindy said (Jul 13)
"QB is still converting some of the fees to Taxable — can we check how EACH service is sent over please."
On invoices where the platform Tax Rate is 0% and the lines are services/fees, QuickBooks is still receiving
some lines flagged **Taxable**, which is wrong for non-taxable service/fee lines.

## Grounding (confirmed in index.html; the QB write is server-side)
- Category → taxable map @index.html:3559-3573:
  `CCH Design Services / Labor / Installation / Transaction Fees / Expenses / Design Fees / Other = taxable:false`;
  `Freight / Postage & Printing / Product / Pass-Through = taxable:true`.
- Per-line taxability = `cchInvoiceLineIsTaxable(item)` (@8596/8598, used by the totals @25838). Category change
  auto-sets `item.taxable` @28586.
- The actual QB push is **`pushDocToQB('invoice',...)`** @40871 → a **cloud function** (not in index.html). The
  SalesItemLine `TaxCodeRef` (TAX vs NON) is set there. That mapping is what to audit.

## HARD EVIDENCE — the QB invoice itself (INV-6051, qbo txnId 75497, Jul 13)
Viewed directly in QuickBooks Online. Confirms both defects:
- **Lines (all mapped to the single QB item "Studio Design Fee"):**
  1. CCH Design Services — 22 × 125 = $2,750.00 — **Tax UNCHECKED** ✅ correct
  2. CCH Design Concept — 16 × 95 = $1,520.00 — **Tax CHECKED** ❌ (service, should be NON)
  3. CCH Client Project Support — 0.5 × 75 = $37.50 — **Tax CHECKED** ❌
  4. CCH Admin — 1.5 × 0 = $0.00 — **Tax CHECKED** ❌
- **Retainer Credit (-$2,500) line is ABSENT** from the QB invoice entirely.
- QB Subtotal $4,307.50; **Taxable subtotal $1,557.50** (= the 3 wrongly-checked lines); sales tax ≈ $120.71
  (~7.75%) → QB total **$4,428.21**. Platform total = **$1,807.50**. Gap = **$2,620.71** = missing $2,500
  retainer + $120.71 phantom tax.
- **Diagnosis confirmed:** (a) tax flag is per-line in the push (all 4 share one QB item, yet differ on Tax), and
  only exactly-mapped categories ("CCH Design Services") get NON — the others ("CCH Design Concept", "CCH Client
  Project Support", "CCH Admin") aren't in the taxable:false map (@3559-3573) so they **default to taxable**. Fix:
  service/fee/credit categories default to **NON**; don't require an exact map hit to be non-taxable.
  (b) the `retainer_credit` line is **not being pushed to QB at all** (it maps to "Other:misc income retainer
  payment" @37201, a different QB item than "Studio Design Fee" — confirm that item exists in QB and that the
  push includes negative/credit lines; right now it's dropped).
- Interim manual fix for THIS invoice (Cindy's call): in QB, uncheck Tax on lines 2/3/4 and add the -$2,500
  retainer line, so INV-6051 reads $1,807.50 now while the code fix + clean re-push is built. Don't collect on
  the $4,428.21 version.

## ADDED (Jul 13) — there is NO "push updates to a synced QB invoice" button (Cindy: "I just want to push and update the QB invoice")
Confirmed gap: `pushDocToQB('invoice',...)` and its "Push to QB" button @index.html:42226 render ONLY when
`!getQbId(docData)` (not yet synced). Once an invoice HAS a QB id, the only QB actions are **"Refresh from QB"**
(pulls FROM QB → would overwrite the platform copy) and **"↻ Update QB ID"** (@65227, just re-links the id).
**There is no way from the UI to push edits UP to an existing QB invoice.** Add an **"Update / Re-push to QB"**
action for synced invoices that **SparseUpdates the existing QB invoice by its QB Id (no duplicate)** and sends
the corrected lines (with the tax + retainer fixes above). This is the button Cindy is looking for and can't find.

## Audit (do this first, report a table)
For EACH line category / expenseType, report what the QB push actually sends as the tax code:
1. Open the QB invoice-push cloud function. Find where each line becomes a `SalesItemLineDetail` and where
   `TaxCodeRef` (or the line `Taxable`/`TaxCodeRef.value` = 'TAX'/'NON', or `GlobalTaxCalculation`) is set.
2. Determine the source of that flag: is it `cchInvoiceLineIsTaxable(line)` / `line.taxable` / the category map,
   or is it **hardcoded to TAX**, or defaulted to TAX when the field is missing? Report which.
3. Cross-check the category map (@3559-3573) for any FEE that's wrongly `taxable:true`. Note anything suspicious
   (e.g., a fee categorized as Freight/Postage/Product would map taxable, which may be the "some fees" Cindy sees).
4. Report the invoice-level tax handling too: when platform Tax Rate = 0%, confirm the push isn't sending a
   company-default taxable code that QB then applies.

## Fix (after the audit, scoped to what the audit finds)
- Each SalesItemLine's tax code must come from the line's real taxability (`cchInvoiceLineIsTaxable(line)` →
  `NON` when false, `TAX` only when true). No hardcoded TAX; no defaulting missing → TAX (default → NON for
  service/fee/credit line types).
- Service/fee/credit expenseTypes (service, design_service, labor, installation, expense, other_expense,
  discount, retainer_credit, handling unless truly taxable) → **NON** in QB.
- Keep genuinely taxable lines (Product, Pass-Through, and Freight/Postage only where CA law + CCH policy make
  them taxable) mapping to TAX per the existing map — do not silently flip those; confirm the map with Cindy if
  the audit shows Freight/Postage should actually be NON for this practice.
- Idempotent: re-pushing / Refresh from QB must not re-taxable a corrected line.

## ADDED (Jul 13) — retainer credit QB mapping + edited-invoice re-push reconciliation
Surfaced on INV-6051 (Manno): platform total is **$1,807.50** but the last QB push toast reported **QB balance
$4,428.21** — they don't match (gap ≈ $2,620.71 ≈ the $2,500 retainer + ~$120 tax). So the retainer credit is NOT
flowing to QB correctly and/or tax is being applied.
- **Retainer credit mapping (grounded):** `retainer_credit` maps to the QB item/account **"Other:misc income
  retainer payment"** (index.html:37201; sidebar preset :38842) and the amount is forced negative (:26655,
  :36332). Intended QB result: a **negative $-2,500 line** on the invoice that drops the QB total to $1,807.50.
  Confirm the QB push actually sends that negative line to that item and that QB's item is configured so it
  reduces the invoice total (verify in the QB push cloud function `pushInvoiceToQB`).
- **Bookkeeping flag (Cindy's call, not the executor's):** representing a retainer as *negative misc income* is
  one method; retainers are often booked as a **customer deposit / liability (unearned revenue)** instead.
  Whether "Other:misc income retainer payment" is the correct account is a decision for Cindy / her accountant —
  do not change the account without her GO; just make the mapping work as configured.
- **Edited-invoice re-push:** an invoice edited after it was already QB-synced must **update the existing QB
  invoice (SparseUpdate by QB DocNumber/Id), not create a duplicate**, and the resulting QB balance must equal
  the platform total ($1,807.50 here). Verify the re-push path (`pushDocToQB` @65969 → cloud fn) updates in place
  and that the negative retainer line + NON tax codes land, so QB and platform reconcile to the penny.

## Acceptance (binary)
1. Audit table delivered: per category/expenseType → the TaxCodeRef the push sends today + the source of the flag.
1b. Re-pushing INV-6051 updates the SAME QB invoice (no duplicate) and QB balance = platform total $1,807.50,
   with the retainer credit as a negative "Other:misc income retainer payment" line and services/fees as NON.
2. After fix, pushing INV-6051 (services + a retainer credit, 0% tax) to QB results in every service/fee/credit
   line as **NON** taxable in QuickBooks; nothing shows Taxable that shouldn't.
3. Genuinely taxable product/pass-through lines still map correctly.
4. No regression to invoice totals in-app; QB invoice total matches the platform total.

## Verify (Claude, staging)
Push a staging invoice with mixed service/fee/credit lines to QB (test realm) → inspect each line's tax code in
QB. Confirm services/fees = NON. Screenshot the audit table + QB result to loop/verify/WO-034/.

## DONE note
loop/WO-034_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
