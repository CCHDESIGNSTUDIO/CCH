# WO-282 DONE — INV-6079 April lines by work, with dates

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** production Firestore only (no hosting)

## Symptom (Cindy)

INV-6079 Client View hours did not match the work (windows/fireplaces 21.8 hrs, cabinets 9.3, pool house 4.5). Edit showed six rate buckets with no dates on the rows.

## Grounding

- Time invoices group by Smart Time **service/rate** (`index.html` ~64355).
- Daily notes had **no dates** (`lineNotes` dump 2026-10-07).
- Edit `description` was empty; dates only possible under Notes.
- Client View glued AI `clientOutcomes` **by index** (`cch-invoice-redesign.js` `_findOutcomeForItem` ~331).
- 27 linked `timeEntryIds`: all **2026-04-01 … 2026-04-30**. No May.

## Change

Production `boards/cloud-rolling-hills/invoices/bCqEJW17QgBgGCDpUqqu`:
- 9 topical lines with `YYYY-MM-DD — N hrs — note` in description and lineNotes
- Meetings with Tracey, on-site, travel pulled out
- Complimentary lighting 4.5 hrs @ $0
- Total **$7,570**, hours **66.5**, April only
- Backup `_backup/wo282-inv-6079-2026-10-07T17-43-09/`

## Verify

Hard refresh INV-6079 Edit: each line’s description lists dated days. Client View: same stories, complimentary line $0. Total $7,570. Do not re-run AI invoice summary.
