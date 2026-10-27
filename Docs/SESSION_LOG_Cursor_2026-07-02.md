# Session log — Cursor — 2026-07-02 (Pacific)

## Overview
PO view page layout + Print/PDF cleanup validated on staging; queued production batch for #1. Showroom bill-from (not started) queued as follow-up.

## Deployed (this session — staging only, direct deploys)
- **Hosting staging** — multiple batches through `poview6` / `poc19` / `om35`
- PO view: status on right rail; line items first; Order management section; bill subtotals; rail button order
- PO Print/PDF: screen=print layout; auto print dialog

## Queued for #1 — PRODUCTION (pending Cindy GO)
See `_DEPLOY_QUEUE.md` batch **2026-07-02 17:30** — commit + `firebase deploy --only hosting:platform --project cch-design-boards` after GO.

## Changed files (working tree, not committed)
- `platform/cch-proposals-invoices-fix.js` — renderDocViewPage PO layout, previewDocument PO print
- `platform/cch-po-bill-variance.js` — status rail split, bill freight/variance footer helpers
- `platform/cch-order-management.js` — `cchOmEnsureNavVisible`
- `platform/index.html` — cache busters poview6, poc19, om35

## Open — next session
**Showroom bills direct:** Implemented Jul 2 — `bill.billFromVendor` on Receive/Edit bill modal; PO vendor unchanged; Vendor Bills list + QB push use payee. Cache buster `poc20`. Functions `pushBillToQB` needs deploy for QB payee.

## Verify (staging)
- https://cch-platform-staging.web.app — PO → Receive/Edit bill → **Bill from** dropdown (Showroom-type vendors)
- Vendor Bills tab shows payee when Bill from ≠ PO manufacturer
- Ctrl+Shift+R; script `poc20`

## Verified by Cindy (2026-07-02)
- **FFE product filter** — Bugletrail Procurement no longer shows Time Billing, Expense, or Pre paid tax rows (v9.8.4 / `ffeprod2`). Issue closed.
