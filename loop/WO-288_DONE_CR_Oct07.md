# WO-288 DONE — INV-6071 off Greene stub onto Greene-Hixson

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** production Firestore + production hosting 9.9.376 (Cindy: fix it)

## Symptom

INV-6071 Client View said **Greene**, no Hixon, no address. Timely project is **Greene - Hixon**. Ledger Project column is **Greene- Hixson**. `greene` is not a real job.

## Grounding

- Real board `greene-hixson`: client **Hixon Metal Finishing**, address **829 Production Pl, Newport Beach, CA 92663**.
- Stub `boards/greene`: name Greene, empty client/address. INV-6071 lived there (`ocunvriheudtqkG3LDs5`). 15 time rows: `project: Greene- Hixson`, `projectId: greene`.
- `resolveBoardIdForTimeLedgerInvoice` (`index.html` ~57813): if every row’s `projectId` is `greene`, it treated “greene” as a match for “greene hixson” because `"greene hixson".indexOf("greene")` is true. Create Invoice wrote the doc onto the stub.

## Change

1. Production Firestore: copied INV-6071 to `greene-hixson` with Hixon name + job address, retargeted 15 time rows, deleted the stub copy, archived `boards/greene`. Backup `_backup/wo288-inv-6071-2026-10-07T23-25-06`.
2. Resolver never returns `greene` when Greene-Hixson exists. Dropped the substring match that let the stub win. Studio **9.9.376**. PRODUCTION hosting 2026-10-07 ~16:26.

## Verify

Hard refresh. Open **Greene-Hixson** (not Greene):  
https://cch-platform.web.app/#/project/greene-hixson/invoice/ocunvriheudtqkG3LDs5  

Prepared for **Hixon Metal Finishing**. Project **Greene- Hixson** with **829 Production Pl**. Sidebar **v9.9.376**.
