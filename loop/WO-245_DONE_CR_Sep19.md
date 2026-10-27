# WO-245 DONE — PO-400124 Feb 27 payment $10,367.50

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-19  
**Change:** production Firestore only (no hosting)

## Symptom

Cindy: she paid **$10,367.50 on 2/27**. PO-400124 had stored **$20,735** on that date (full bill) with `$10,367.50` only in the note. By the time of this write she had already removed the $20,735 row; only the Feb 26 Deposit $10,367.50 remained.

## Change

Added ACH/Wire **$10,367.50** dated **2026-02-27**, vendor invoice **66640**. Deposit row unchanged. Paid **$20,735**, balance **$0**. Lines / bill total / IN-10161 untouched.

## Backup

`_backup/wo245-po400124-pay-2026-09-19T23-29-06-552Z/po.json`

## Verify

https://cch-platform.web.app/#/project/west-avalon/po/gbiAgUUR5lp1baB3MZO4 — hard refresh. Applied payments: Deposit Feb 26 $10,367.50 + Feb 27 $10,367.50. Paid $20,735. Bill balance $0.
