# WO-243 DONE — IN-10161 restore second Feb ACH

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-19  
**Change:** production Firestore only (no hosting)

## Symptom

Cindy on West Avalon **IN-10161**: Applied Payments showed a **July 17 $5,000 Check**. Vaughn made **two ACH $5,000** the same day (Feb 15 / QB Feb 16). July 17 is not from Vaughn.

## Grounding

- Rail paint: `invoiceDocPaymentSummary` `platform/index.html` ~31523 from `inv.payments[]`.
- Studio Record Payment: `quickRecordPayment` ~46326 — default method **Check**, id `pay_` + Date.now().
- Live before: `pay_1783968333086` Check date `2026-07-17`, `recordedAt` 2026-07-13, no Houzz/QB id.
- First Houzz row kept: ACH `py_3T1a0fFdCE6n8elI1ZmLhB2O` date `02/15/2026` source `houzz-new`.
- Jul 5 backup `FIRESTORE_BACKUP_2026-07-05/boards/west-avalon.json` ~1899 already had **both** Houzz ACHs: `py_3T1a0fFdCE6n8elI1ZmLhB2O` and `py_3T1ZR2FdCE6n8elI0nX1AeRI`.
- Houzz `payment_compact.json` IN-10161: two ACH $5,000 dated 2026-02-16.

## Change

Replaced the July 17 Studio check with the missing Houzz ACH. Paid stays **$10,000**. Invoice `total` $32,512, items, tax, status **Partially Paid** untouched.

Gave both rows distinct `id` / `reference` = the `py_…` ids so `_dedupeInvoicePaymentRows` (~66463) cannot collapse two same-date $5k fingerprints.

## Backup

`_backup/wo243-in10161-payments-2026-09-19T21-04-15-135Z/invoice.json`

## Self-test

Post-write read: two ACH 02/15/2026 $5,000 each; refs `py_3T1a0f…` and `py_3T1ZR2…`; `paidAmount` 10000; `total` 32512; no `pay_1783968333086`.

## Verify (Cindy)

https://cch-platform.web.app/#/project/west-avalon/invoice/vEsvMohWndbv6HqXMd8a — hard refresh. Applied Payments: two **ACH $5,000** dated **02/15/2026**. No July 17 Check.
