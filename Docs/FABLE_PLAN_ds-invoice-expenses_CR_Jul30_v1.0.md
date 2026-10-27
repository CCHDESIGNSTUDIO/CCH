# FABLE PLAN — Design Services invoice expenses · CR Jul 30 v1.0

**For:** Claude / Fable review (lock rules — stop churn)  
**Status:** DRAFT for Fable — Cindy has not typed FINAL LOCK yet  
**Why this exists:** Same expense corner has been patched many times (ds12→ds19, prepaid1/2, INV-6006 / INV-6054). Agents keep “fixing” layout instead of obeying one frozen model.

**Canon one-liner (Cindy Jul 30):**  
Hours layout stays sacred. Expenses look like product lines (description, qty, cost, subtotal). Pre-Paid Sales Tax lives under totals only. No fat fee summary. No Terms & Notes boilerplate on invoice print.

---

## 1. Problem

Design-services Client View / Print keeps re-classifying the same lines:

| Wrong state (seen) | Why it hurt |
|---|---|
| Expense / T&E / reimbursable as `1 hrs` | Looks like billable time; blocks trust |
| Money only in a bottom “fee dump” card | Duplicates lines; changes the luxury hours sheet |
| Pre-Paid Sales Tax as a SERVICE body row | Cindy wants it under Tax / totals only |
| Terms & Notes (“All fees are non-refundable…”) on Print | Cindy: remove that note |
| Blank page 1 on Print | Print CSS `min-height:100vh` churn (secondary) |

Root structural issue: **three render paths** + **heuristic classifiers** (`expenseType`, title regex, `cchInvoiceLineUseServiceStyleInView`, stale `clientOutcomes`) disagree.

---

## 2. Surfaces (do not conflate)

| Surface | File(s) | Role |
|---|---|---|
| **A. DS Client View / Print** (luxury sheet) | `platform/cch-invoice-redesign.js` | Numbered hour outcomes + expense table + Total Due |
| **B. Premium product Print/PDF** | `platform/cch-proposals-invoices-fix.js` | Category tables: Service / Qty / Price / Shipping / Total |
| **C. Manage / edit table** | `fix.js` + `index.html` doc edit | Working table — not the client gift |

INV-6009 screenshots hit **A** and **B** at different times. Fable must say which surface owns which rule. Staging ≠ prod data.

---

## 3. Proposed locked rules (Cindy direction — for Fable to confirm / amend)

### R1 — Hour lines (HOT HOURS) — DO NOT TOUCH LAYOUT
- Numbered gold outcomes (`01`, title, optional date/hrs/rate toggles).
- Only true **service / time** lines.
- Never show expense money as `hrs` or `$/hr`.

### R2 — Expense lines — product-style on the same Client View
- Same invoice, below hours (not inside the hours outcome grid).
- Columns: **Item + description · Qty · Cost · Subtotal**.
- Description fillable via Manage (line notes / description); empty may show italic placeholder “Description”.
- Types that belong here (proposed):  
  `expense`, `other_expense`, `shipping`, `handling`, `freight`, plus T&E / reimbursable / Print & Post / packing fee **by type or explicit billing category** — not fuzzy forever.

### R3 — Pre-Paid Sales Tax — totals only
- Never a body SERVICE / expense table row on client Print.
- Always a totals row under Sales Tax (peach/red label), peeled out of Subtotal.
- Applies to **A** and **B**.

### R4 — Totals card — no fee shopping list
- Allowed: Design Services hours rollup (if any), Pre-Paid Sales Tax, calculated Sales Tax, credits, Paid / Balance, **Total Due**.
- Forbidden: re-listing every expense that already appears in the product-style expense table.

### R5 — Terms & Notes on invoice Print
- Hide default boilerplate Terms & Notes on invoice Print/PDF.
- (Open: keep custom memo if Cindy typed a real note? Current ship: hide all invoice memo on Print.)

### R6 — Manage unchanged except data
- Studio continues to edit qty / cost / description / expenseType in Manage.
- Client View is display-only for these rules (doc isolation still holds).

### R7 — Freeze clause
- After Fable + Cindy lock: **no layout experiments** on expenses without a new FABLE decision doc.
- Bugfixes only with file:line grounding against these rules.

---

## 4. Code truth (Jul 30 working copy — evidence for Fable, not gospel)

Staging shipped intent: **v9.9.56–9.9.57** / `cch-invoice-redesign.js?v=20260730ds19` / `cch-proposals-invoices-fix.js?v=20260730prepaid2`.

**A — redesign.js**
- `_outcomes` → service lines only (`_isServiceLine`).
- `_expenseProductRows` / `_isExpenseProductLine` → product-style table.
- `_passThroughFeeRows` → **sales_tax only** for totals.
- Heuristics still in `_isExpenseProductLine` (T&E helper + title regex) — **this is the churn magnet**; Fable should replace with a typed allowlist if possible.

**B — fix.js premium Print**
- Skip `cchIsVendorPrepaidSalesTaxLine` in body; peel into totals.
- Invoice Print: no Terms & Notes memo block.

**Open risk:** `cchInvoiceLineUseServiceStyleInView` still marks T&E as “service-style” for Manage/product table; redesign tries to override for DS Client View. Dual classification = future regressions.

---

## 5. What Fable should return

Please answer in a short **FABLE DECISION** (same shape as room-placement):

1. Confirm or rewrite **R1–R7** as locked product law.
2. **Classifier:** type-only vs type+billingCategory allowlist (kill title regex?).
3. **Surfaces:** Does R2 apply only to DS layout (A), or also premium Print (B)?
4. **Memo:** hide all invoice Terms on Print, or only the default boilerplate string?
5. **Ship gate:** staging proof invoice ID + screenshot checklist, then Cindy GO for prod.
6. Explicit **STOP list** for Cursor (what not to “improve”).

---

## 6. Verify checklist (after lock)

- [ ] True hour line still looks like luxury outcome (no product columns).
- [ ] T&E / reimbursable / handling show Qty · Cost · Subtotal — never `1 hrs`.
- [ ] Pre-Paid Sales Tax only under totals — not in SHIPPING & ADJUSTMENTS body.
- [ ] No itemized fee dump under Total Due.
- [ ] No Terms & Notes boilerplate on Print.
- [ ] Manage still edits description / qty / cost.
- [ ] Prod vs staging: test staging-native DS invoice (INV-6009 is prod-only).

---

## 7. Ask of Cindy (one sentence to lock)

> “Hours stay as hours; expenses are product lines with description, qty, cost, subtotal; prepaid tax only under totals; no fee summary; no Terms note on print — freeze that.”

If Fable amends any clause, Cursor implements **only** the delta from the decision doc — minimal diff, no redesign.
