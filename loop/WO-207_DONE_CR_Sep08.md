# WO-207 DONE — PO shipping on Confirm (copied from the PO)

**Change ID:** 9.9.329  
**Date:** 2026-09-08  
**Executor:** Cursor  

## Symptom

Cindy Sep 8 PO-9049 Perennials: shipping was inside the line total ($4,038 vs 36×$106=$3,816) and the Confirm / Est. freight field was blank, so she had to type $111 again. Follow-up: *why re-enter shipping if it is already on the PO?*

## Grounding (this turn)

- Confirm modal `cchPoOpenMarkConfirmedModal` (`cch-po-bill-variance.js` ~5189) already *displays* `cchPoShippingTotal(doc)` (sum of `item.shipping`).
- Vendor-invoice **Est. freight** (`#cchVigEstFreight` ~5560) was value `''` unless `existing.estimatedFreight` was already saved. It never read the PO.
- `cchPoSubmitMarkConfirmed` ~5288 copies PO shipping into `estimatedFreight` only when that field is empty — after save, not in the blank box she types into.
- `docEditRecalcTotals` / `docEditSave` PO branches returned after merchandise and skipped `totalShipping += ship` (`index.html` ~41271 / ~41730).

## Root cause

Confirmation treated freight as a new typed field. The PO already has it on the Shipping column (`item.shipping`). Actual freight on a **ship invoice** stays typed — that can differ from the PO.

## Change

- `cchPoOpenVendorInvoiceGroupModal`: Est. freight prefills from `cchPoShippingTotal` when empty. Label **from this PO**.
- `cchPoVigDocumentTypeChanged`: switching to confirmation fills empty Est. freight from the PO.
- `cchPoSaveVendorInvoiceGroup`: confirmation with blank Est. freight writes PO shipping.
- Confirm modal copy: shipping is from this PO; do not re-enter.
- `docEditRecalcTotals` + `docEditSave`: PO still adds line `shipping` into document shipping total.

`index.html` **9.9.329** `po-confirm-ship-from-po-2026-09-08`; `cch-po-bill-variance.js?v=20260908ship1` (same file as WO-208 overlay).

Surfaces: PO Confirm + vendor-invoice confirmation Est. freight. Not invoice/proposal line math. Not print restyle. Actual freight on ship invoice still blank until the vendor invoice arrives.

## Self-test

- `node --check platform/cch-po-bill-variance.js` — pass.
- File ends `})();`.

## Verify (after staging)

PO with Shipping $111 on Edit (not baked into line total): Confirm order shows Merchandise / Shipping $111 (from this PO) / Total. Vendor invoice document type Confirmation — Est. freight already $111. Change shipping on **Edit PO**, not by retyping Confirm.
