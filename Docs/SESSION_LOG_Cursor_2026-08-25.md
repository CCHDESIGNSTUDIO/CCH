# Session log — Cursor — 2026-08-25

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Overview

Cindy: Houzz matching — push the PO, then the Bill connected to that PO, so bank feed **Match** works. Also: easy way to add variances (freight/tax/extras) without editing the QB Purchase Order.

## What changed

### Studio **9.9.266** — **PRODUCTION** hosting + functions 2026-08-25 ~15:00 (Cindy GO)

QuickBooks: Send PO pushes a Purchase Order; vendor Bill is linked to that PO; freight/tax/extras are extra Bill lines (PO not edited). Payments never push.

1. **Send PO to vendor** also pushes a QBO **Purchase Order**.
2. **Push/Sync vendor bill** creates/updates a QBO **Bill** with `LinkedTxn` → that Purchase Order.
3. Freight, tax, labor, price change, other extras on the Studio bill become extra QB Bill lines. Merchandise line is the only line linked to the PO. Bank **Match** uses the Bill **total**.
4. `lookupAirtablePoReceiver` created on production (receiver = Ship To UI from 9.9.265).

Live: https://cch-platform.web.app `CCH_BUILD` **9.9.266**. Cache `?v=20260825pobill1`. Not committed.

### Hotfix — PO unit cost + customer — **PRODUCTION** functions 2026-08-26 ~11:15 (Cindy GO)

Cindy: Fancy Concrete **PO-9019** in QBO showed Qty 4, Rate **3.75**, Amount **$15**. Same class as the clip gold-price bug: unit cost sent as a line total, then divided by qty.

**Grounding:** `ensureQbPurchaseOrderForStudioPo` used `item.cost` as Amount then `UnitPrice: lineTotal / qty` (`Functions/index.js`). Studio PO `cost` is unit (`cchDocLineUnitCost` in `index.html`). Print already does `cost * qty`.

**Change:** `qbStudioPoLineMoney` — UnitPrice = unit cost, Amount = cost × qty (+ line shipping). Invoice sell `lineTotal / qty` and bill lines (qty 1, bill totals) left alone — bills were correct.

**Already in QBO:** PO-9019 / PO-9044 are not overwritten. Cindy edited rates in QuickBooks.

**PRODUCTION** `pushPOToQB` + `pushBillToQB` deployed 2026-08-26 ~11:15 (Cindy GO, #1). Hosting unchanged (still 9.9.266). Not committed.

Also: PO lines now get `CustomerRef` (project QB customer, same resolver as bills) + `ShipAddr` from that customer. Does not write Received/Closed — QBO fills Received when a Bill is LinkedTxn to a PO line (our merch bill attaches to line 1, so Daza Bowl showed Received 1 / Closed).

## Open items

- Visual Comfort two CC amounts ($1,318.80 and $1,438.80) need **one QB Bill per vendor invoice** to Match — still one lumped BL per Studio PO.
- Existing matched `BL-` bills: do not bulk-create POs under them.
- Fancy Concrete QBO POs already pushed: Cindy edited in QB (push will not overwrite).

## Verify commands

1. https://cch-platform.web.app — Ctrl+Shift+R — **no** orange banner — sidebar **v9.9.266**
2. Small PO: Send → QBO Purchase Order
3. Sync bill with freight → Bill linked to that PO + extra freight line
4. Match the bank feed to the Bill

1. Send a new PO → QBO Purchase Order appears (itemized)
2. Receive vendor bill with freight/tax → Sync bill → QBO Bill linked to that PO; extra lines for freight/tax; Match bank to the Bill total
