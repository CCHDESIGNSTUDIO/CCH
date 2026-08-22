# WO-026 DONE · Unique Labor/DS/Expense icons; stop WT leak · Cursor · Aug 21, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)  
**Attempt:** 1 of 3 · **Staging only.** No money / QB / tax / isolation change.

## Grounding (this session)

- Grep: `wtExpense`, `cchLineIconKind`, `presetRow`, `cchLineIconPlaceholderByKind`
- Read: `platform/cch-line-icons.js` (full file); `presetRow` + call sites `platform/index.html:43257–43318`; adders `addSidebarServiceToDoc` / `addSidebarLaborToDoc` / `addSidebarExpenseToDoc` `:43599–43640`; `_cchPersistedFieldsForKind` `:41085–41104`

**Root cause:** `cchLineIconKind` returned `wtExpense` for almost every expense and for image-less products (`:58–63`, `:77` old). `presetRow` printed 2-letter tags (`DS`/`LB`/`SH`) in a tan box and never called the SVG map.

## Files touched

| File | Lines | What |
|------|-------|------|
| `platform/cch-line-icons.js` | SVG map; `cchLineIconKind` ~111–176 | New kinds + WT-only gate. Generic product → `default`. |
| `platform/index.html` | `presetRow` `:43257–43270`; Labor/DS/Expense call sites `:43280–43318`; `CCH_BUILD` `:4295`; script tag `:87070` | Picker uses `cchLineIconPlaceholderByKind(kind, 36)` via same `cchLineIconKind` probe. Build **9.9.244**. Cache `cch-line-icons.js?v=20260821wo026`. |

## Behavior

1. `wtLabor` / `wtExpense` / bartolo WT variants **only** when the line is actually window-treatment (custom window / drapery / roman shade / valance / cornice / curtains, or WT workroom material with those words).
2. Each Labor / Design Service / Expense / Tax / Retainer preset has its own SVG (truck, envelope, card, clock, hammer, eye, pendant, etc.).
3. `+ Add item` picker and document IMG column use the same `cchLineIconKind()` map.
4. Image-less generic product → existing 📦 `default`, not WT.
5. No `expenseType`, QB maps, `taxable`, amounts, or `cch-doc-isolation.js` edits.

## Self-test

- `node --check platform/cch-line-icons.js` — clean
- Node probe of 32 preset/product cases — all expected kinds (Freight=`expFreight`, Retainer=`retainerCredit`, WT fabrication=`wtLabor`, Installation Labor=`installLabor`, image-less product=`default`, Hixon roman shade product=`wtExpense`)
- `index.html` tail still closes `</html>`

## Verify (Claude, staging)

1. Hard refresh → sidebar **v9.9.244** · script `cch-line-icons.js?v=20260821wo026`
2. Proposal Edit → **+ Add item** → Labor, Design, Expenses. Screenshot three tabs → `loop/verify/WO-026/`
3. Add Freight + Retainer Credit + Custom Window Treatments — Fabrication. IMG: truck / minus-box / WT needle — three different icons
4. Known WT proposal (Hixon if on staging) still shows WT on real WT lines

## Deploy

Queued staging in `_DEPLOY_QUEUE.md`. No commit. No production.

## Rollback

Revert `cch-line-icons.js` + `presetRow` / cache buster / `CCH_BUILD`. No Firestore rollback.
