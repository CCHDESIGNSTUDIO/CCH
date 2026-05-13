# Code audit brief — Purchase orders, vendors, Houzz import

**Audience:** Second AI, contractor, or senior engineer doing a focused code review.  
**Repo:** `CCHDESIGNSTUDIO/CCH` (this tree: `cch-deploy/`).  
**Date written:** 2026-05-11.

**Related (product vocabulary — not PO-specific):** `PRODUCT-GLOSSARY-BOARDS.md` defines **Inspiration** vs **Design Boards** vs **Style Library** so audits and refactors do not conflate them.

## 1. Why this matters

Purchase orders tie money to vendors. Wrong vendor labels, duplicate PO documents for one Houzz PO number, or inconsistent paid/balance logic undermine trust in Studio vs Houzz Pro and complicate QuickBooks alignment.

## 2. Problems already observed (acceptance criteria for “done”)

- **List vs Houzz:** Project PO list showed client names or wrong vendors in the Vendor column while Houzz PO detail showed the correct payee (e.g. company on PO vs line-item supplier).
- **Same PO number, different story:** Same human-readable PO number (e.g. `PO-12893`) could appear as different Firestore documents or different line content than Houzz’s single PO.
- **Paid vs balance:** UI showed “Paid” while balance due was non-zero, or subtotal/payment math disagreed with visible line inputs.
- **Doc id vs PO number:** Deep link `#/project/{id}/po/{docId}` uses Firestore **document id**, not the PO number string; confusion when multiple docs or slug ids exist.
- **PO edit layout regression (2026):** The **Purchase Order editing page** (`renderDocEditPage` when `type === 'po'`) is reported to have **reverted to the old layout** instead of the newer Studio layout. Audit should determine whether this is **conditional** (e.g. `data-theme="classic"`, feature flag, route, or cached HTML), **duplicate render paths**, or **deploy drift** (e.g. wrong `index.html` or partial CDN cache).

## 3. Scope — what to review (priority order)

1. **Houzz Project Tracker import** — grouping keys, how `vendor` and line items are written for `purchaseOrders`.
2. **PO list / detail / save paths** — single source of truth for `vendor`, `items[]`, `paidAmount`, `payments[]`, `total`, `status`.
2b. **PO edit page layout** — one clear code path for PO document UI; theme / layout switches; ensure “new” vs “classic” layout is intentional and documented, not accidental regression.
3. **Merge / backfill tools** — payment merge from spreadsheets, clip-derived PO synthesis, any code that overwrites vendor or splits POs.
4. **Display-only helpers** — anything that *infers* vendor for UI must be clearly labeled so it is not mistaken for stored truth.

## 4. Primary files (non-exhaustive)

| Area | Path |
|------|------|
| Monolith UI + import modal + PO tabs + audit modal | `platform/index.html` |
| Houzz-related fixes / vendor invoice → PO | `platform/cch-proposals-invoices-fix.js` |
| Shared helpers / vendor PO listing | `platform/cch-functions.js` |
| Standalone Houzz data script (if used in ops) | `import-houzz-data.js` |
| Cloud Functions (QB, webhooks) | `functions/index.js` |

### Symbols / regions worth grepping in `platform/index.html`

- `confirmImport` — Pass 4 “Building purchase orders” (PO grouping and `purchaseOrders` writes).
- `parseHouzzData` / `handleImportFile` — column mapping from tracker XLSX.
- `resolvePOVendorDisplay`, `renderPOsTab`, `projSortItems` (vendor sort for POs).
- `renderPODetail`, `renderDocEditPage` — PO editor, header subtitle, line items. **Trace all branches** that build PO edit HTML (including any early `return` or alternate template for classic theme).
- `data-theme`, `themeToggle`, `Classic Layout`, `[data-theme="classic"]` — CSS and JS that swap PO / doc-edit chrome; grep for `doc-edit` and `renderDocEditPage` callers.
- `poResolvedPaidAmount`, `mergeHouzzPoPaymentsFromTxnFile`, `showPODataAuditModal` / `runPODataAuditScan`.
- Clip merge into POs: `clip-po-`, `_fromClips`, `poMap` / `poGroups` patterns under `purchaseOrders`.

## 5. Recent intentional changes (verify correctness & edge cases)

- **Import Pass 4:** PO documents are grouped **by PO number only** (not `PO number + row vendor`). Header `vendor` is chosen from **dominant line purchase spend** among tracker rows, with fallbacks. Line items mapped to fields the editor expects (`title`, `cost`, `qty`, `shipping`, `amount`, `vendor` per line).
- **Project PO list:** `_displayVendor` / `resolvePOVendorDisplay` to avoid showing project client strings as vendor when line items imply a supplier; search row; `togglePOVendor`; sort uses display vendor for PO type.
- **Admin “PO audit” modal:** Read-only scan for duplicate PO numbers per project, vendor matching client names, header vs line-vendor spend, paid-with-balance anomalies; CSV download.

**Note:** The **PO edit page layout** is **not** listed above as an intentional change; if production shows the old layout, treat that as a **regression or deploy/cache issue** until proven otherwise.

## 6. Questions for the auditor

1. Are there **any remaining code paths** that create a second `purchaseOrders` doc for the same normalized PO number (import, clip merge, scripts, Functions)?
2. Does **payment import** (`mergeHouzzPoPaymentsFromTxnFile` and any JSON batch jobs) ever match the **wrong** document when both a random id and a slug id exist?
3. Is **`vendor` on the PO header** ever derived from **selling-side** or **client** fields by mistake?
4. For **multi-vendor POs** in Houzz, is “dominant spend” the right header rule, or should header come from an explicit column if added later?
5. Are **Firestore security rules** consistent with who can create/update `purchaseOrders` (no accidental client writes)?
6. **Regression tests:** What minimal automated or scripted checks would you add (e.g. fixture XLSX → expected PO count and vendor)?
7. **PO edit layout:** Why would the PO editing surface show the **old** layout again? List every branch (theme, user role, A/B, `window` flag, separate bundle, service worker) that could change `renderDocEditPage` output for `type === 'po'`. Recommend a **single canonical layout** or an explicit user-controlled toggle with visible label.

## 7. Out of scope / clarifications

- **Production data** is in Firebase; this audit is **code + rules**, not a row-by-row data cleanse (separate ops / CSV workflow).
- Parent folder `CCH-Platform-Deploy` may contain non-git assets; the **git root** is `cch-deploy/`.
- **Deployed site vs repo:** If PO edit looks “old” only on `*.web.app` / production, compare **hashes or file size** of hosted `index.html` to the built artifact from this repo (Firebase Hosting cache, wrong target, or unpushed commits).

## 8. Suggested review output format

Please return:

1. **Findings** ordered by severity (wrong money / wrong party first).  
2. **File:line** (or symbol) references where possible.  
3. **Recommended fix** (one sentence each) vs **optional hardening**.  
4. **Residual risk** if no code change.

---

*End of brief.*
