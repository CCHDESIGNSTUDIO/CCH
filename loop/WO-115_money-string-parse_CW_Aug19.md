# WO-115 · Money stored as `"$1985.00"` reads as 0 platform-wide — v1.0 · CW Aug 19

**Change ID:** BF-011 · **Executor:** Cursor · **Verifier:** Claude · **Attempt:** 1 of 3
**Lane:** Studio platform · **Deploy target:** staging (production needs Cindy's typed GO)

## The problem (Cindy, Aug 19)

Costs entered against clips and proposal lines show as $0. Cindy: *"I put a cost in for every clip."* Chasing it found the values are present in Firestore and unreadable by the code.

## Grounded mechanism

`parseFloat("$1985.00")` → `NaN`; every consumer coerces `NaN` to `0`. The money is stored, and reads as zero in every total, margin, report and export.

**Measured on production, 19,879 documents** (`boards/*/clips`, `products`, `productLibrary`) via `_scripts/count-string-costs_BY_CLAUDE_2026-08-19.js`:

| Field | `$`-string | number | empty |
|---|---|---|---|
| `clientPrice` | **5,039** | 8,226 | 1,285 |
| `cost` | **1,586** | 11,726 | 4,830 |
| `retailPrice` | 1 | 190 | 376 |

**5,375 of 19,879 documents** carry at least one. By board: park-city 2,009 · shimano-westridge-lane 1,134 · katke-puerto-vallarta 585 · cloud-mustang 430 · cch 330 · johnny 296 · cloud-huntington-beach 246 · katke-graceland-dr 182 · bradbury-high-drive 145 · cloud-rolling-hills 7.

Sample doc — `boards/cloud-rolling-hills/clips/05umcrfzCP8EKjjhMljy`, field `cost = "$1985.00"` (string), `clientPrice = 3970` (number).

**Two parsers exist and disagree:**

- `parseMoney()` — `platform/index.html:4544` — **correct**: `parseFloat(String(v).replace(/[$,]/g, '')) || 0`
- `cchParseTradeCost()` — `platform/cch-cost-lock.js:15` — **wrong**: `var n = parseFloat(v);` → `null` for every `$`-string

**249 call sites use raw `parseFloat` on money fields and never reach `parseMoney`:**

| File | Sites |
|---|---|
| `platform/index.html` | 195 |
| `platform/cch-po-bill-variance.js` | 25 |
| `platform/cch-proposals-invoices-fix.js` | 20 |
| `platform/cch-functions.js` | 3 |
| `platform/cch-invoice-redesign.js` | 2 |
| `platform/cch-pepper.js` | 2 |
| `platform/cch-invoice-tax-rules.js` | 1 |
| `platform/cch-square-pay.js` | 1 |

Highest-value site — `docEditSave`, `platform/index.html:40392`: `const cost = parseFloat(item.cost) || 0;` — this decides document totals.

## What to build

### A. Fix `cchParseTradeCost` — `platform/cch-cost-lock.js:15`

```js
// BEFORE
var n = parseFloat(v);
// AFTER
var n = (typeof v === 'number') ? v : parseFloat(String(v).replace(/[$,\s]/g, ''));
```

Apply the same to `parseMoney` in `platform/cch-ffe-procurement.js:50` if it lacks the strip.

### B. Route money reads through `parseMoney`

Replace `parseFloat(<obj>.<field>)` with `parseMoney(<obj>.<field>)` for these fields only:
`cost`, `unitCost`, `costPrice`, `clientPrice`, `retailPrice`, `unitRetailPrice`, `amount`, `totalSelling`, `unitSellingPrice`, `totalCost`, `totalPurchaseCost`, `shippingSellingPrice`, `rate`, `shipping`.

Export the parser for the modules: `window.parseMoney = parseMoney;` beside the definition at `index.html:4544`, or give each `cch-*.js` a local copy.

### C. Data normalization — DO NOT BUILD IN THIS ORDER

Cut as a follow-up WO after A and B verify. A and B make the existing data readable without any write.

## HARD RULES

1. **Do not blanket-replace `parseFloat`.** `qty`, `markupPct`, array indices, and counts stay as-is. Money fields only, per the list in B.
2. **Never synthesize `markupPct` or `clientPrice`.** Cindy sells retail on some lines with no markup — a missing markup is not a defect. Cost only.
3. **No writes in this order.** Read-path only. No migration, no backfill, no Firestore writes.
4. **RESOLVE vs APPLY** (CLAUDE.md Rule 3) unchanged — this order adds no auto-persist.
5. **No layout changes** (CLAUDE.md Rule 4).
6. Ground before editing per `CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md` — re-grep, read the bodies, cite file:line. The counts above are a lead, not evidence.
7. Staging only. Never commit, push, or deploy from the shared working copy.

## Acceptance (binary)

1. `cchParseTradeCost("$1985.00")` returns `1985` — not `null`.
2. `cchParseTradeCost("$1,985.00")` returns `1985`.
3. `cchParseTradeCost(1985)` still returns `1985`; `cchParseTradeCost("")` and `cchParseTradeCost(null)` still return `null`; a negative still returns `null`.
4. Zero raw `parseFloat(` calls remain against the money fields listed in B, across all eight files.
5. `parseMoney` is reachable from every `cch-*.js` module that now calls it (no `ReferenceError` in console on load).
6. Opening a clip whose stored `cost` is a `$`-string shows the numeric cost in the UI, not 0.
7. An invoice with only numeric costs produces a grand total **identical** to before the change — record the before/after total for one known invoice in the DONE note.
8. No Firestore document is written by this order.

## Verify (Claude, staging)

- `boards/cloud-rolling-hills/clips/05umcrfzCP8EKjjhMljy` — `cost` renders as 1985.00, not 0.
- Open a park-city document (2,009 affected docs) and confirm line costs and totals populate.
- Re-run `_scripts/count-string-costs_BY_CLAUDE_2026-08-19.js` — counts unchanged, since this order writes nothing.
- Console clean on load for `index.html` and `client.html`.
- Evidence into `loop/verify/`.

## Rollback

Single-commit revert. No data written, so rollback is code-only with no cleanup.

## Out of scope — do not fix here

- **Clipper writes `cost: null`** on new clips (proposal-sourced clips retain cost; clipper-sourced arrive null). Separate WO.
- **`selDupKeyForItem` — `platform/index.html:18118`** ignores SKU; key order is `lib:` → `url:` → `title|vendor`, so one product in two finishes collapses to one row. Every finish has its own SKU. Separate WO.
- **Finish/library mislinking** — clip with SKU `WM.337 8 3/4` (medium white bronze) linked to library slug `337_urban_pull__..._natural_bronze`. Separate WO.
