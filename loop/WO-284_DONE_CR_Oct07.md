# WO-284 DONE — INV-6079 combine meetings / lighting / outdoor / misc

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** production Firestore + production hosting (Cindy GO 2026-10-07 ~11:46). Studio 9.9.374.

## Symptom (Cindy)

Client View INV-6079: combine 7+8 outdoor, remove Complimentary, combine 04+05 lighting, combine all meetings. Misc services = entry ceiling rendering, master-bath window treatments, game room & theater model updates and renderings. Do not use SKP.

## Grounding

- Client View rows come from invoice `items` + matching `clientOutcomes` (`cch-invoice-redesign.js` `_outcomes` ~345, `_findOutcomeForItem` ~331).
- Hours showed 1.8 / 21.8 / 9.3 because `_metaHtml` used `Math.round(h * 10) / 10` (~525). `_fmtQty` (~540) already keeps quarter hours.
- Combined lighting/outdoor/misc mix $195/$95/$75. `invoiceLineAmountForTotals` (`index.html` ~31398) uses rate×qty when rate > 0, which made $7,569.93. Mixed lines store `rate: 0` + exact `amount` so the sell fallback keeps **$7,570**.

## Change

Production `boards/cloud-rolling-hills/invoices/bCqEJW17QgBgGCDpUqqu` — 5 lines, 62 hrs (complimentary 4.5 dropped), **$7,570**:

1. Meetings — 9h @ $195 — $1,755 (calls + on-site)
2. Travel — 1.75h @ $75 — $131.25
3. Lighting selections, schedules & specs — 31h — $2,760
4. Outdoor BBQ, bar, landscape & pool house — 12h — $2,040
5. Misc services — 8.25h — $883.75 — entry ceiling, master-bath windows, game room & theater. No SKP.

Backup `_backup/wo284-inv-6079-2026-10-07T18-14-33/`

Code (not live until hosting GO): `_metaHtml` / `_totalsBlock` use `_fmtQty` so 1.75 stays 1.75. Cache `cch-invoice-redesign.js?v=20261007wo284`. Studio 9.9.374.

## Verify

Hard refresh INV-6079 Client View: 5 lines, no Complimentary, Misc wording as above, Total $7,570. Travel may still show **1.8 hrs** until production hosting GO. Then 1.75 and 8.25. Do not re-run AI summary.
