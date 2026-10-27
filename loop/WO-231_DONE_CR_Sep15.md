# WO-231 DONE — Receive bill modal stays on QB fail

**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED  
**Studio:** 9.9.350 (ships with WO-232)

Cindy: mid PO-9042 bill, thrown out twice.

## Grounding

Production PO-9042 (`west-avalon` / `bBWUEo5GgFQk19M0I1ii`): `qbDocId` 75830, `bill.received` false — Push created the QB PO before a Studio bill was saved. Overlay click closed the form (`cchReceiveBillModal` backdrop). After a failed Push, `cchPoSaveReceiveBill` closed the modal then `cchPoAfterFulfillmentStatusSaved` remounted the page (`cch-po-bill-variance.js` ~6308–6339, ~6607–6623).

QB date error: bill `TxnDate` from `vendorInvoiceDate` before the PO date (`Functions/index.js` ~3052).

## Change

- Receive bill: no backdrop dismiss; Cancel only.
- Save / Push: keep the modal if QB push fails; do not `navigate` on error; alerts `zIndex` 10050.
- `pushBillToQB`: bill date is later of vendor invoice date, PO date, and QB PO `TxnDate`.

## Self-test

`node --check platform/cch-po-bill-variance.js` and `Functions/index.js`.

## Verify

Staging: Receive vendor bill — click dimmed overlay does not close. Push fail leaves the form. Production functions needed for the date clamp (QB push is production-only).

PO-9042: bill was **not** saved. Reopen Receive vendor bill, use **Save**. PO already in QB as 75830 dated 2026-08-16.
