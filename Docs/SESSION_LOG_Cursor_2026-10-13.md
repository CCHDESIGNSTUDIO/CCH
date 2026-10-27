# Session log — Cursor — 2026-10-13

## WO-298

Cancelled is a charge type on Edit bill. Check the item and write the reason. Amount is the opposite of that PO line, so the line total on the bill is $0. The purchase order line stays. Other $0 charges are still ignored. Studio 9.9.386. Queued production. Not deployed. Print was not changed. PO-9028 was not edited in Firestore.

## WO-297

Cindy GO. INV-6079 Edit descriptions were empty and the box was one line tall. Production invoice `bCqEJW17QgBgGCDpUqqu` now has the Oct 7 date lines on Meetings, Travel, Lighting, Outdoor, and Misc services, plus Complimentary lighting 4.5 hrs at $0 (April 9 and April 14, not billed). Qty, rate, and amount on the original five lines were not changed. Stored total left at 7569.92. Backup `_backup/wo297-inv-6079-2026-10-13T23-28-35-785Z/`.

Edit description box no longer has a 36px cap. Studio 9.9.385. PRODUCTION hosting 2026-10-13 ~16:29. That deploy also included WO-296 (confirmed PO status). Print CSS was not changed. Client View still hides hourly rates.

## WO-296

PO-9056, PO-9057, and PO-9059 are already Confirmed in the order lane, with order confirmation numbers. The document status field is still Draft, and the PO page listed Draft as a checked step beside Confirmed. The status line now shows only the current status. An order conf # counts as confirmed without an email. Queued production. Studio 9.9.384. Needs a typed GO. Not deployed. Print was not changed. `node --check` passed.

## Mission Tile West SO31527

Arto PO-9057, Tabarka PO-9059, and Artistic Tile PO-9056 were checked against sales order SO31527 ($36,676.82). The three Studio bills were $37,194.11. Tax on the bills was about 9.75% of merchandise. The sales order tax is 7.75% of merchandise plus freight, $2,638.01. Correct tax lines: Arto $457.12, Tabarka $1,352.83, Artistic Tile $828.06. Line totals that match the order: Arto $5,455.80, Tabarka $17,105.89, Artistic Tile $10,242.12. No payments marked. No QuickBooks push.

## Production hosting

Cindy GO. `firebase deploy --only hosting:platform --project cch-design-boards` at about 09:36. Live https://cch-platform.web.app is Studio 9.9.383. Confirmed `cch-po-bill-variance.js?v=20261012wo294` contains Invoice line total, and index.html contains 9.9.383. No commit. Functions not deployed.

Shipped together: WO-290 pre-paid tax on the PO rail, WO-291 invoice line total, WO-292 price captions, WO-293 quantity change, WO-294 QuickBooks push reminders, WO-295 PO line photos. Ledger stays DONE-UNVERIFIED.
