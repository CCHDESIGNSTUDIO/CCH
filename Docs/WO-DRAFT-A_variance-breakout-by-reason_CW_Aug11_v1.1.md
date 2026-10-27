# WO-DRAFT-A: Break PO variances out by reason, with per-component billability

**v1.1 · Aug 11, 2026** · Lane: **Cursor** · Page: `cch-platform.web.app/#/ordermanagement/variances`
**Primary file:** `platform/cch-po-bill-variance.js` (`cchPoOpenReceiveBillModal`, the Order Management variances view, and `cchPoBatchAddVariancesToInvoice`)
**Related spec:** `Docs/SPEC_PO_Bill_Variance_Workflow_v1.0.md` · **Staging first; prod on Cindy GO.**

> **Changes in v1.1 (grounded against the live `cch-po-bill-variance.js`, Aug 11):**
> 1. **`taxable` defaults corrected.** Merchandise-cost codes (`price_increase`, `cost_difference`, `larger_size`, `tariff`) now default **taxable = YES**, not NO. v1.0 would have under-collected CA tax CCH still owes CDTFA (Pub 35: the marked-up selling price of merchandise is taxable). Only delivery/service codes default NO.
> 2. **Data model.** Do NOT add a parallel `varianceComponents[]` array. The component amounts already exist on the bill charge rows (`{source, label, amount}`, @2792 / split @1952 / @2396). Hang the new fields on those. Resolves the v1.0 §4.1 💩.
> 3. **Named the code.** The single-word REASON is `cchPoPickVarianceReason` (@2806); its `price_change → 'price_increase'` remap (@2813) is the same bug as the REASON-vs-strip mismatch. The tax default lives in `VARIANCE_REASONS` (@244, line 246 currently `tax → billable_to_client`, the live double-charge). Write-guard belongs in `cchPoBatchAddVariancesToInvoice` (@6285).

---

## 1. The defect, stated plainly

The variances grid shows **one row per PO**, **one net dollar amount**, **one reason label**, but the underlying variance blends components with different billing treatments.

PO-9004 (KRAVET, 7225 Bugletrail): reason strip lists Brunschwig & Fils; Freight #12375692; Pre-paid tax #12375692; Price change / credit #12375692; Tariff #12375692. The REASON column says one word, **freight**; VARIANCE says **$517.37**. Selecting the row and clicking **Add to client invoice** pushes the whole blended number, including the pre-paid tax, which the client already paid via the taxable sell line. That is a double-charge, and it is live.

**Confirmed in code:** `VARIANCE_REASONS` (@244) currently defaults `tax` (Pre-paid tax), `shipping`, `expedited`, and `price_increase` all to `billable_to_client`. The platform has been actively suggesting the vendor's pre-paid tax as billable. This raises the stakes on §6.

---

## 2. What is currently at risk on screen

Selection reads **7 selected · $4,035.39** (verified sum of the seven checked Rolling Hills net variances):

| PO | Vendor | Net variance | Tax component in strip? |
|---|---|---|---|
| PO-9027 | Barn Electric | $1,832.59 | **Yes** (Pre-paid tax + Designer discount x4) |
| PO-9031 | Ravenhill Studio | $1,016.83 | **Yes** (Freight, Pre-paid tax, Price change / credit) |
| PO-9034 | SPJ Lighting Inc. | $148.92 | No (Freight only) |
| PO-9035 | Urban Electric | $514.93 | **Yes** (Freight, Pre-paid tax) |
| PO-9029 | Etsy | $394.43 | **Yes** (Freight, Pre-paid tax, Price change / credit x2) |
| PO-9025 | 1st Dibs | $99.35 | **Yes** (Freight, Pre-paid tax, Price change / credit x2) |
| PO-9037 | MyKnobs | $28.34 | **Yes** (Freight, Pre-paid tax) |
| | **Total** | **$4,035.39** | |

Six of seven contain pre-paid tax. Only PO-9034 ($148.92, freight only) is safe to push as-is. The other **$3,886.47** is unsafe as a lump, not because it is all tax, but because the screen gives no way to know how much is, and the button does not check.

---

## 3. Why pre-paid tax specifically is not billable (verified vs CDTFA Pub 35)

When a vendor charges CA sales tax on a purchase (tax paid at source), the correct treatment is to carry that tax **inside cost**, then sell the item at cost times markup with the line **taxable = YES**. The client invoice's own tax line then charges the client tax on the marked-up selling price, which is larger than the tax paid the vendor. You are made whole automatically, through the sell line. Pub 35 confirms the marked-up selling price of merchandise is taxable, and the vendor's tax is recovered via the "tax-paid purchases resold" deduction, **not by billing the client**.

Adding a pre-paid tax variance to the client invoice is the tax appearing a second time. The "no report to CDTFA" half is a **remittance** fact, not a billing one, and the two must not be conflated.

**Rule:** every tax-family component is a **cost** event. It belongs in Profit Tracker and margin, never in the Add-to-client-invoice path.

---

## 4. Change: one row per variance component

### 4.1 Data model — extend the existing charge rows (do NOT add a parallel array)

The bill already stores its lines as charge rows carrying `source`, `label`, `amount`, and the vendor invoice ref (`{source:'freight'|'tax'|'price_change'|'extra'|'merchandise'|'po', amount, ...}`, @2792; the freight/tax/priceChange/extras split @1952; `tryAdd` with `vendorInvoiceNumber` @2396). **The component amounts already exist.** This is a rollup + disposition + rendering change, not a new capture step.

Add these fields **onto the existing charge rows** (not a duplicate collection):
```
disposition:  'billable' | 'absorbed' | 'credit_to_client' | 'undecided'
taxable:      <bool>            // default per §4.2, NOT a blanket false
priceBasis:   'cost' | 'cost_x_markup'   // default 'cost'; INDEPENDENT of taxable
invoicedOnId: <client invoice id once pushed, else null>
decidedBy, decidedAt
```
**Reconciliation invariant:** `sum(chargeRows.amount)` must equal `billTotal - poTotal`. It already does today, so extending the existing rows preserves it for free. If a gap ever appears, render it as a visible `source:'unallocated'`, `disposition:'undecided'` row. Money never vanishes into a rounding gap.

### 4.2 Reason enum and defaults (taxable corrected)

Collapse the two vocabularies into one enum. The charge `source` tokens (lowercase `freight`, `tax`, `price_change`, ...) and the `VARIANCE_REASONS` ids (`shipping`, `expedited`, `restocking`, ...) are two different sets today; merge them. PO-9027's REASON reading "Price increase" while its strip says "Price change / credit" is the `cchPoPickVarianceReason` remap (@2813), fixed here in the same pass.

| reasonCode | Display | Default disposition | Default taxable | Rationale |
|---|---|---|---|---|
| `freight` | Freight / shipping | Billable | **NO** | Delivery, if separately stated + common carrier. Handling IS taxable; if freight+handling are combined, tax the handling portion. |
| `tariff` | Tariff / duty | Billable | **YES** | Part of the landed cost of the good, folded into its selling price. |
| `price_increase` | Price increase | Billable | **YES** | Additional selling price of tangible goods (Pub 35). |
| `cost_difference` | Difference in cost | Billable | **YES** | Same class as price increase. |
| `larger_size` | Purchased a larger size | Billable | **YES** | Client-driven upgrade = additional selling price of a good. |
| `prepaid_tax` | Pre-paid tax (paid at source) | **Absorbed** | n/a | Already recovered via the taxable sell line. §3. Corrects `VARIANCE_REASONS` line 246. |
| `vendor_tax` | Tax charged by vendor | **Absorbed** | n/a | Same event. **Merge into `prepaid_tax`.** |
| `tax` | TAX | **Absorbed** | n/a | Same event. **Merge into `prepaid_tax`.** |
| `designer_discount` | Designer discount | Absorbed (margin) | n/a | Negative; client already approved the sell price. |
| `shop_discount` | Shop discount | Absorbed (margin) | n/a | Negative; same reasoning. |
| `finish_less_money` | Finish selected was less money | **Credit to client** | **NO** | Client received less than approved; the credit is theirs. |
| `price_change_credit` | Price change / credit | **Undecided** | n/a | Ambiguous: a vendor credit is margin, a price change is billable. **Never default. Force a human pick.** |
| `increase` | Increase | **Undecided** | n/a | Non-specific legacy label. Retire, force a remap. |
| `unallocated` | Unallocated remainder | **Undecided** | n/a | Reconciliation gap. Resolve before the PO is selectable. |

**Principle:** taxability follows the nature of the component, not the markup choice. Anything that is part of the selling price of tangible personal property (price increase, upgrade, tariff, cost difference) defaults **taxable = YES**; genuine delivery/service defaults NO. `priceBasis:'at cost'` (a margin decision) must NEVER imply `taxable:NO`.

### 4.3 Grid behavior
- **Parent row (per PO):** PO total, bill total, net variance. Muted, informational, **not selectable.** Net variance stays visible (it is still the right number to reconcile against the vendor bill), it is just the wrong number to bill from.
- **Child rows (per component):** indented, one per charge row, each with amount, reason chip, checkbox.
- **Absorbed** children: checkbox **disabled**, lock icon, tooltip *"Already recovered on the client invoice tax line. Not billable to the client."* Stay visible so the parent net reconciles.
- **Undecided** children: amber, required **Set disposition**. Parent PO cannot be actioned while any child is undecided.
- Per selected **billable** component, inline: `Taxable` toggle (default per §4.2) and `Price basis` toggle (`at cost` default / `cost x markup`).

### 4.4 Selection summary
Replace `7 selected · $4,035.39` with a three-part readout that never hides the absorbed money:
> **N components selected · $X billable · $Y absorbed (tax + discounts) · $Z undecided**

Full variance stays visible. Only the **billable** figure can reach a client invoice.

### 4.5 Hard guard on the write path
`Add to client invoice` (`cchPoBatchAddVariancesToInvoice` @6285) must **reject** any component whose `reasonCode` is in the tax family (`prepaid_tax`, `vendor_tax`, `tax`), enforced **in the write function, not only the UI**. Override exists but is expensive: typed confirmation + mandatory reason note + an audit entry naming user, amount, note.

---

## 5. Migration (no auto-splitting of what exists)

Because the component amounts already live on the charge rows, most current bills **can** be broken out automatically. Only truly legacy lumped bills without charge rows cannot.
1. Bills whose components cannot be derived get `needsVarianceAllocation: true`, show an amber **Allocate** button, and are **not selectable** until allocated.
2. Anything already pushed to a client invoice is **left untouched.** No retroactive rewrite.
3. Run a **dry-run manifest first** (proposed component split per PO, reconciliation invariant checked per row) for Cindy's review before any write. Same pattern as the QB reconciliation work.

---

## 6. Do this before building anything — read-only backfill audit

Query every variance already pushed to a client invoice whose reason string contains a tax token (`Pre-paid tax`, `Tax charged by vendor`, `TAX`). Output: project, PO, client invoice, date sent, variance amount, reason strip.

This is **cheap and now urgent**: the charge rows with `source:'tax'` and their amounts already exist, and `VARIANCE_REASONS` line 246 has been defaulting pre-paid tax to `billable_to_client`, so some may already have gone out. It is read-only, touches nothing, and answers "have I already double-charged someone, and on which invoices." A yes on a sent invoice is a client-facing correction with its own timeline; it should not wait behind the UI build.

---

## 7. Out of scope (flag as follow-ons)
- Vendor bill PDF upload/extraction (separate Pepper-pack F item).
- Any change to how the client invoice computes its own tax line.
- **QB push mapping (hard follow-on, not a maybe):** whatever `taxable` a component carries must survive the QB sync. There is a known open item where Studio's `taxable:false` does not map to a non-taxable QB tax code on time invoices. Assume it applies here, or a component correctly marked `taxable:true` that loses the flag in QB re-creates the under-collection at the books layer.
- Retiring `increase` / `price_change_credit` from historical records.

---

## 8. Verify anchors
1. Open a PO whose bill has freight + pre-paid tax. Grid shows a parent + two child rows; child amounts sum exactly to the parent net.
2. The pre-paid tax child's checkbox is disabled with the lock tooltip.
3. Select the freight child only. Readout shows freight billable, tax absorbed, both visible.
4. Add to client invoice: invoice receives the freight amount only, at cost, taxable = NO.
5. A `price_increase` child defaults **taxable = YES**; a `freight` child defaults NO.
6. Force the tax component through a bypassed UI: the write function rejects it.
7. A `price_change_credit` PO cannot be actioned until a disposition is set.
8. A legacy lumped PO shows Allocate and is not selectable.
9. No previously sent client invoice changes by a cent.

---

## 9. Sources / grounding
- `platform/cch-po-bill-variance.js`: `VARIANCE_REASONS` @244 (tax default @246), `cchPoPickVarianceReason` @2806 (remap @2813), bill charge rows @2792 / @1952 / @2396, `cchPoBatchAddVariancesToInvoice` @6285.
- [CDTFA Publication 35](https://cdtfa.ca.gov/formspubs/pub35.pdf) — marked-up merchandise is taxable; tax-paid-purchases-resold deduction.

*v1.1, Aug 11 2026. Corrections folded from the Aug 11 code-grounded review. Ready for Cursor ingest.*
