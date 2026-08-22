# WO-026 · Unique icons for Labor / Design Services / Expenses — stop window-treatment leak · v1.1 · CR Aug 21

**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)  
**Priority:** Small, daily irritant. Oldest real OPEN code bug.  
**Attempt:** 0 of 3 · **Staging only** until Cindy typed GO. No data change. No isolation / QB / tax-flag change.

## What Cindy said

**Jul 11:** “I asked to create new icons for the window-treatment labor and it put them everywhere — I just didn't want the brown boxes.” The navy/gold **window-treatment** glyph (shade / fabric bolt) shows on generic fee lines. It should only appear on actual window-treatment items.

**Aug 21 (this rewrite):** Screenshots of the **+ Add item** Labor / Design Services / Expenses picker. Labor and Design Services already have distinct glyphs; Expenses still sit in the same **tan/brown boxes**, and the WT icon still leaks onto fees / retainers / image-less products. Write this order so Cursor adds **one unique icon per preset**, and **never** stamps the WT icon on a non-WT expense.

## Two surfaces (same icon map)

| Surface | Where (this turn) | What Cindy sees |
|---------|-------------------|-----------------|
| **A. Add-item sidebar presets** | `platform/index.html` `presetRow()` **:43254** — 36px box with 2-letter tags (`DS` `LB` `SH` `HD` `EX` `RC` `TX`) on `background:rgba(10,31,61,0.06)` | The “brown boxes.” Labor **:43278**, Design **:43265**, Expenses **:43294**, Retainer **:43274** |
| **B. Document line IMG** (no product photo) | `platform/cch-line-icons.js` `cchLineIconKind()` **:33–78**; callers `index.html:14952+`, `39815+`, `cch-proposals-invoices-fix.js:3282+` | Same leak on the invoice/proposal table |

Picker and line IMG must use **the same kind**. Do not invent a second mapping.

## Root cause (grounded — `cch-line-icons.js`)

Only five SVG kinds exist today (`SVG` **:8–13**): `wtLabor`, `wtExpense`, `pillowLabor`, `furnitureLabor`, `wallcoveringLabor`.

`cchLineIconKind()` **:58–63** treats almost every expense as window-treatment:

```
isExpense = et in (expense|shipping|handling|other_expense)
         OR lc === 'expense'
         OR wcc in (lining|hardware|trim|shipping)
→ return wtExpense   // fabric-bolt / shade icon
```

**`:77`** `if (et === 'product') return 'wtExpense'` — image-less product also gets the WT icon. (`:76` already returns `default` when the product has an image.)

Labor fall-through **:65–74** also over-matches (`shade|panel|installation` in any blob → `wtLabor`), so Installation Labor / Site Supervision can steal the WT needle icon.

`presetRow` **does not call** `cchLineIconPlaceholderByKind` at all — it prints letter tags. That is why Expenses look like empty brown squares even when a unique SVG could exist.

## Screenshot inventory — required unique kinds

Navy `#0A1F3D` · Gold `#C8A97E`. No emoji. No native `alert`. Keep sharp rectangles (no border-radius on the picker chrome). `cch-line-icons.js` may add `border-radius:4px` on the 36–64px glyph tile only if that already matches existing placeholders.

### LABOR (`laborPresets` :43279–43286)

| Preset | Icon (Cindy screenshot) | Kind | Notes |
|--------|-------------------------|------|--------|
| Custom Upholstery / Fabrication | sofa / tufted rectangle | `furnitureLabor` | already in SVG |
| Custom Window Treatments — Fabrication | needle + gold thread / valance | `wtLabor` | **only** this labor row may use WT labor |
| Wallpaper Installation | sheet with folded corner | `wallcoveringLabor` | already in SVG |
| Installation Labor | pendant / plumb | **new** `installLabor` | do **not** use `wtLabor` |
| Site Supervision | eye | **new** `siteSupervision` | |
| General Labor | hammer | **new** `generalLabor` | |

### DESIGN SERVICES (`_cchProposalDesignRateSheetPresets` :42568 + `SERVICE_TYPES` :49104)

Match by **name contains**, not exact string (labels vary: “CCH Design Services” vs “Design Fees — use Smart Time rates”).

| Preset (screenshot) | Icon | Kind |
|---------------------|------|------|
| Design Fees — Smart Time rates | clock | **new** `dsSmartTime` |
| CCH Design Services | diamond outline | **new** `dsDesign` |
| Client Project Support | two interlocking circles | **new** `dsSupport` |
| Project Management | three horizontal lines | **new** `dsPm` |
| Design Concept | square + circle overlap | **new** `dsConcept` |
| Blended Design Services | half-filled circle | **new** `dsBlended` |
| Admin | document lines | **new** `dsAdmin` |
| Studio & Design | 2×2 grid | **new** `dsStudio` |
| Time Entry | plus between bars | **new** `dsTimeEntry` |
| Research | magnifying glass | **new** `dsResearch` |
| ELU | solid diamond | **new** `dsElu` |
| Other Design Service / unknown DS | diamond outline | `dsDesign` (fallback, **not** `wtExpense`) |
| Retainer Credit (`:43274`) | (own glyph — tag or minus-in-box) | **new** `retainerCredit` — **never** `wtExpense` |

T&E as a **Smart Time service type** (`SERVICE_TYPES` has T&E) vs T&E as an **expense preset**: use the **expense** T&E icon when `expenseType` is expense; use a travel glyph for both so they don’t look like WT.

### EXPENSES + TAX (`exPresets` :43296–43305 + tax `:43295`)

| Preset | Icon (screenshot) | Kind |
|--------|-------------------|------|
| Freight / Shipping | truck | **new** `expFreight` |
| Handling & Packing Fee | 2×2 pane (not WT shade) | **new** `expHandling` |
| Print & Post | envelope | **new** `expPrint` |
| T&E (Travel & Entertainment) | paper plane | **new** `expTe` |
| CC Fee / Transaction Fee | card | **new** `expCcFee` |
| Samples | three vertical bars | **new** `expSamples` |
| Reimbursable Expense | circular arrow | **new** `expReimburse` |
| Discount / Credit | price tag | **new** `expDiscount` |
| Other Expense | ellipsis | **new** `expOther` |
| Pre-Paid Sales Tax | % in a square | **new** `expSalesTax` |

**Forbidden:** `wtExpense` / `bartoloWtExpense` on any row in this table.

## Change (Cursor)

1. **`cchLineIconKind()`** — return `wtExpense` / `wtLabor` / bartolo WT variants **only** when the line is genuinely window-treatment:
   - Labor title/category matches Custom Window Treatments / drapery / roman shade / valance / cornice / WT workroom, **or**
   - Expense is a WT material: `wcc` lining/hardware/trim **and** WT title/category, Bartolo WT, or title lining/blackout/interlining/iron rod.
   - Bare `et === 'expense'|'shipping'|'handling'|'other_expense'|'discount'|'retainer_credit'|'sales_tax'` with **no** WT signal → the matching **new** kind above, else `default`.
2. **`:77`** — generic `et === 'product'` with no image → `default`, not `wtExpense`.
3. **Add SVG entries** to `SVG` for every new kind. Style: same stroke weight / navy+gold as existing five. Keep `bartolo*` wrapping via `baseKind()`.
4. **`presetRow()` :43254** — replace the 2-letter `esc(icon)` box with `cchLineIconPlaceholderByKind(kind, 36)` (or 40). Pass a `__forceKind` or a tiny probe item `{ title, expenseType, itemType, cchLineCategory }` so picker and document agree. Do **not** leave `DS`/`LB`/`SH` as the visible glyph.
5. Bump cache: `index.html` script tag `cch-line-icons.js?v=20260709wr1` → a new token (e.g. `20260821wo026`).
6. `node --check platform/cch-line-icons.js`. Bump `CCH_BUILD` patch.

## HARD RULES

1. **Surgical.** Only `cch-line-icons.js` + `presetRow` / the few `presetRow(...)` call sites in the add-item sidebar (~43254–43313). Do not restyle the rest of the sidebar. Do not split `index.html`.
2. **Do not change** `expenseType`, QB account maps (`:41106`), `taxable`, line amounts, or `cch-doc-isolation.js`.
3. **Hixon / WT proposals unchanged** for real WT product + install lines (shade-with-W / needle icon).
4. **Pillow / furniture / wallcovering** paths **:47–56** stay. Do not route those to WT.
5. Ground again before edit (this WO’s line numbers are a lead). Re-grep `wtExpense`, `presetRow`, `cchLineIconKind`.
6. No commit / no production deploy. Queue staging in `_DEPLOY_QUEUE.md`.

## Acceptance (binary)

1. Freight, Handling, Print & Post, T&E, CC Fee, Samples, Reimbursable, Other Expense, Discount/Credit, Retainer Credit, Pre-Paid Sales Tax — **no** WT shade/bolt icon in picker **or** on the document IMG.
2. Custom Window Treatments — Fabrication still shows **`wtLabor`**. A real WT product line (e.g. Hixon shade) still shows WT.
3. Each Labor / Design Service / Expense / Tax preset in the tables above has a **distinct** glyph (not a shared brown box, not a 2-letter tag).
4. Adding Freight from the picker puts the **truck** (or the chosen `expFreight` SVG) on the new invoice/proposal line IMG.
5. Image-less generic product → `default` (existing 📦 placeholder), not WT.
6. `node --check platform/cch-line-icons.js` clean. No console errors on Add item → Labor / Design / Expenses.

## Verify (Claude, staging)

1. Proposal Edit → **+ Add item** → Labor, Design, Expenses. Screenshot all three tabs → `loop/verify/WO-026/`.
2. Add Freight + Retainer Credit + Custom Window Treatments — Fabrication to a test proposal. Confirm IMG column: truck / retainer glyph / WT needle — three different icons.
3. Open a known WT proposal (Hixon if present on staging; otherwise a staging-native WT doc). WT lines still WT.
4. Hard refresh. Sidebar build tag includes the new `cch-line-icons.js` cache buster.

## DONE note

`loop/WO-026_DONE_CR_[MonDD].md` + `_DEPLOY_QUEUE.md` line (staging). Ledger → DONE-UNVERIFIED. Never VERIFIED / never prod.

## Rollback

Revert `cch-line-icons.js` + `presetRow` / cache buster. No Firestore rollback.

## Revision history

- v1.0 (Jul 11, CW): Scope `wtExpense` off generic fees; use `default` blank box.
- v1.1 (Aug 21, CR): Cindy screenshots. Blank box is **not** enough — unique icon per Labor / DS / Expense / Tax / Retainer preset. Same map on picker and line IMG. Grounded `presetRow :43254` + `cchLineIconKind :58–77`.
