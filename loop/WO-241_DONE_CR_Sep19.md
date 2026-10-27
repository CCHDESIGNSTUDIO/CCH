# WO-241 DONE — Invoice Manage ⋮⋮ drag (Chrome/Edge)

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-19  
**Studio:** 9.9.356 `inv-manage-drag`

## Symptom

Cindy on West Avalon IN-10161: cannot reorder lines on **Manage**. Edit table ⋮⋮ already moved rows.

## Grounding

- Edit drag: `docEditRowDragStart` `platform/index.html` ~42596 — sets `dataTransfer.effectAllowed` + `text/plain`.
- Manage drag: `invoiceRowDragStart` `platform/index.html` ~11439 — stored `_invoiceRowDrag` only. No `setData`. Chrome/Edge often never fire `drop`.
- Manage HTML: `renderInvoiceManageLanding` `platform/cch-proposals-invoices-fix.js` ~4230 (group) and ~4292 (line) — `ondragstart` did not pass `event`.
- Drop already existed: `invoiceRowDropOn` ~11449 writes `items` order to Firestore.

Client View has no reorder. That is by design.

## Change

1. `invoiceRowDragStart(projectId, invoiceId, idx, ev)` — same dataTransfer handshake as Edit.
2. Manage ⋮⋮ `ondragstart` passes `event`.
3. `CCH_BUILD` 9.9.356. Cache buster `cch-proposals-invoices-fix.js?v=20260919inv241`.

## Surfaces

Invoice **Manage** landing only. Edit drag unchanged. Client View unchanged. Proposals/POs/print not touched.

## Self-test

- `node --check platform\cch-proposals-invoices-fix.js` — pass
- index.html tail still closes `</html>`
- fix.js tail still closes `})();`

## Verify (after staging deploy)

1. https://cch-platform-staging.web.app — Ctrl+Shift+R
2. Open an invoice → **Manage** (not Client View, not Edit Invoice)
3. Grab the left **⋮⋮** (not the photo or title)
4. Drop on another row → toast “Order updated”
5. Hard refresh — order sticks
