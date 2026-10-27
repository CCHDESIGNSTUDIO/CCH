# WO-208 DONE — OM Variances: invoiced freight/price-increase leave Ready

**Change ID:** 9.9.328  
**Date:** 2026-09-08  
**Executor:** Cursor  

## Symptom

Cindy Sep 8 production `#/ordermanagement/variances`: Cloud – Rolling Hills PO-9030 / 9031 / 9034 / 9035 / 9029 / 9037 still listed under Ready to bill with Freight / Pre-paid tax / Price increase children. She had already billed those variances.

## Grounding (this turn)

- Prod Firestore `cloud-rolling-hills`: all of those freight/price-increase lines are on **INV-6063** (Paid), `source: 'po_bill_variance'`, with `poId` + `varianceComponentId` (`vc_0_freight`, `vc_2_price_increase`, …).
- `bill.items[].invoicedOnId` is **null** on every matching PO. `variance.linkedClientInvoiceId` is set only on 9030 / 9035 / 9037.
- `cchPoBillAdditionalExpenseFields` (`cch-po-bill-variance.js` ~3067) builds children from `vendorInvoices` / header freight-tax fields and did not copy `invoicedOnId`.
- Add-to-invoice stamped `bill.items` only when `it.id === componentId` (~7184). Derived ids are `vc_*`; bill items have no id — stamp never wrote.
- `cchPoVarianceReadyToBill` (~6704) ignored `linkedClientInvoiceId` whenever child components existed, so 9030 stayed Ready even with the parent link.

## Root cause

Ready to bill never consulted client invoice lines. Stamp + parent-link gates both missed, so invoiced freight kept painting as open.

## Change

Files:

- `platform/cch-po-bill-variance.js`
  - `cchPoBillAdditionalExpenseFields` (~3075, ~3086): pass through `invoicedOnId`.
  - `cchPoVarianceReadyToBill` (~6715): `linkedClientInvoiceId` ⇒ not Ready.
  - New `cchPoBuildVarianceInvoiceHitIndex` / `cchPoApplyVarianceInvoiceHits` (~6728): overlay `invoicedOnId` from invoice lines (`po_bill_variance` / `var_*`).
  - New `cchPoStampBillComponentInvoiced` (~6795): stamp `vendorInvoices[n]` from `vc_N_*` and `bill.items` by id or reason.
  - `cchPoCollectVarianceRows` (~7364): load invoices with POs; apply overlay; fill parent `invoiceId`.
  - Batch add (~7284): use the stamp helper so the next add persists.
- `platform/index.html` **9.9.328** `var-invoiced-hide-2026-09-08`; `cch-po-bill-variance.js?v=20260908var1`.

Display-only overlay for existing INV-6063 rows (no Firestore heal). Prepaid tax stays lock/absorbed and is not a client line.

Surfaces: Order Management → Variances (firm-wide + project tab). Not print. Not invoice Total math. Not PO Edit layout.

## Self-test

- `node --check platform/cch-po-bill-variance.js` — pass.
- File ends with IIFE `})();`.
- Probe: INV-6063 lines match `vc_0_freight` / `vc_2_price_increase` / `vc_3_price_increase` for the six POs. After overlay, no remaining selectable (tax family excluded) → parent `readyToBill` false.

## Verify (after staging hosting)

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **9.9.328**.
2. Staging data will not have INV-6063. Confirm on **production** after Cindy GO: `#/ordermanagement/variances` Ready to bill — those six RH POs gone.
3. Chip **On invoice** / **All** — they still list, status On invoice.
4. A PO with unbilled freight still appears on Ready with a checkbox.

WO-207 (PO-9049 shipping) remains IN PROGRESS and is not in this number.
