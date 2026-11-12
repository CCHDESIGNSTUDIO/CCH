# Session log — Cursor — 2026-11-05

## Overview

Cindy: Rolling Hills miscellaneous freight on the invoice was doubled, and she needs to send it.

## What changed

WO-404. Production invoice INV-6086 (`pftDOyPOdztvpeqn6KBP`). The shipping move had left the old price in `rate`, so each freight line counted as product and as shipping. Cleared `rate` and `unitPrice` on 14 lines. Shipping stays $4,888.20, once. Descriptions, expense lines, and tax $336.64 were not changed.

`platform/index.html` `invoiceLineAmountForTotals` now returns 0 when amount and cost are 0 and shipping is set. Build 9.9.481. Not deployed.

## Hours grouping

WO-405. INV-6092 Client View was one row per day. The letter now groups the same service and the same rate, and adds the hours. Edit still has one line per time entry. Studio 9.9.482. Production hosting 2026-11-05 15:32. Live version confirmed 9.9.482.

## Time descriptions

WO-406. The time sentence was stored in both the description and Notes, and Notes hid it because they matched. Service lines keep it. Client Show notes lists each day. Studio 9.9.483 production, live confirmed. No commit. No Firestore rewrite.

No commit. No functions deploy. No QuickBooks push. The freight rate guard in 9.9.482 went out with this hosting deploy. INV-6086 data was already corrected this morning.

## Verify

Hard refresh https://cch-platform.web.app and open INV-6086. Close any old edit tab without saving. Freight should show in Shipping only. Combined shipping $4,888.20. Other lines $5,686.70. Tax still $336.64.
