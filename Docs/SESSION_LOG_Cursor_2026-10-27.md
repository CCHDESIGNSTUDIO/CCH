# Session log — Cursor — 2026-10-28

## WO-392

INV-6086. Draft variance lines were titled with the product, or with a vendor invoice number. Titles are now the charge: Freight or Price/qty change. Amounts unchanged. Studio 9.9.472.

## WO-391

PO-9050. Bill to was still 2181 Laguna Canyon Rd because that address was already saved and clicking the same vendor name did not replace it. Opening the PO now uses the vendor record: 712 Valley #F, Anaheim, CA 92801. Studio 9.9.471.

## WO-390

PO-9050. The vendor list cache had the name only, so OC Custom Furniture’s address was never read. The record is 712 Valley #F, Anaheim, CA 92801. Studio 9.9.470.

## WO-389

PO-9050. The bottom bar was the save notice: Save failed, then a reason. Picking OC Custom Furniture now looks up the vendor and workroom record and replaces the Bill to address when one is on file. Studio 9.9.469.

## WO-388

PO-9050 edit. Bill to vendor is a dropdown of vendors and workrooms. OC Custom Furniture stays the selected name. Line costs were not changed. Studio 9.9.468.

## WO-387

PO-9072. The purchase order cost stays the original merchandise. The bill total is only the rail Bills figure, taken from the ship invoices still on the PO. The old stored bill total is no longer shown a second time. Variance is that bill minus the locked PO. PO lines were not rewritten. Studio 9.9.467. Production deploy follows in this chat.

## WO-386

Studio 9.9.466 production. Edit vendor bill on PO-9072 keeps the line table. Additional charges sit under it, each with its own invoice number and note. Save no longer writes the header invoice number onto those charges. A bill line under each purchase order line shows invoice number, tax, shipping, note, and the difference. Stored amounts were not rewritten.

# Session log — Cursor — 2026-10-27

## WO-385

Studio 9.9.465 production. Client invoice variance lines no longer show purchase-order prices. The description is Freight or Price/qty change. The vendor invoice number is in the line notes. Amounts were not changed. Hard refresh the invoice she has open.

## Overview

Cindy’s Oct 27 addendum replaces the financial-health money row. WO-360. Staging only.

## What changed

- `platform/index.html` — Studio 9.9.442. Invoices and POs/Bills each show total, paid, and open. Profit is pre-tax invoiced minus the PO/bill total. Needs-attention strip under the money row. The company dashboard and the project sidebar use the same numbers.
- `platform/cch-po-bill-variance.js` — reconciliation reads the existing variance lines. Cache `?v=20261027wo360`.

## Production

Cindy GO 2026-10-27 ~11:13. Hosting only. Live was 9.9.440. Now 9.9.443 at https://cch-platform.web.app. Functions not deployed. No commit.

## WO-384

Studio 9.9.464 production. Buried charges leave the Bill variances working list. The lines still showing on Cloud Rolling Hills are stored as Pass on: PO-9060 $49.75, PO-9046 $498.06, PO-9032 $52.50 freight.

## WO-383

Studio 9.9.464 production. Freight label is larger. Invoice Notes no longer shows Vendor bill variances. New variance invoices copy the room and the product image. INV-6088 Saginaw and Tandem images were copied from the purchase orders. Amounts were not changed.

## WO-382

Studio 9.9.462 production. On PO-9009 the vendor invoice Order status and Ship & delivery were blank while the line said Shipped and ETA Jun 18. Those columns now use the line, then the purchase-order ship status. Stored fields were not rewritten.

## WO-381

Studio 9.9.461 production. On PO-9015 the rail led with Not billed. That row is gone. PO total is the first amount, then Bills, then Paid.

## WO-380

Studio 9.9.460 production. The purchase order rail leads with Not billed, then PO total, Bills, and Paid. Not billed is the lines that are not on a ship invoice. Edit, Print, Pay bill, and Record credit are back under the receiver block. Stored amounts were not rewritten.

## WO-379

Studio 9.9.459 production. An actual ship date sets that vendor invoice’s order status to Shipped. A status that is already Delivered or further along stays. Saving the invoice does not ask to confirm the order again.

## WO-378

Studio 9.9.458 production. The Brock ship invoice row was showing the whole bill, $5,806.07, because the bill header number matched that invoice. The row total is now that invoice’s own lines, $1,318.80. The stored bill was not rewritten.

## WO-377

Studio 9.9.457 production. Edit PO, Print / PDF, Pay bill, and Record credit are the first block on the purchase order rail.

## WO-376

Studio 9.9.456 production. The vendor invoice editor was showing a combined total of $5,806.07 on Brock’s invoice. That invoice is $1,318.80. The screen now shows this invoice total. Saving the row does not write the combined figure. The stored bill was not rewritten.

## WO-375

Studio 9.9.455 production. Add vendor invoice was filling the confirmation number and three purchase-order prices. The bill has no invoice lines. The preview now lists the vendor invoice numbers stored on the payments. The purchase order card shows those invoice numbers instead of “No invoice #”. PO-9017 amounts were not rewritten.

## WO-374

Studio 9.9.454 production. The purchase order totals card is Bill, Paid, and Open balance. Paid is the sum of the payments, shown as money paid. Open balance is what is still owed. No amounts were rewritten.

## WO-373

Studio 9.9.453 production. Edit vendor bill groups items under the shipment invoice date. Lines the shipment does not list say Not invoiced. The purchase order page shows the same date under the item. Amounts unchanged. Proposals, invoices, and print were not changed.

## WO-372

Studio 9.9.452 production. OC Custom Furniture `qbVendorId` is 1353. Edit vendor, workroom, and receiver now has QuickBooks vendor Id. No purchase order or bill was rewritten. Functions not deployed.

## WO-371

Studio 9.9.452 production. Workrooms and receivers are a list again. Open the name to see that company’s purchase orders. Edit stays on the Edit button.

## WO-370

Studio 9.9.450 production. Workrooms and receivers list purchase orders under each company, matched on the vendor name or the ship-to. Hard refresh Workrooms.

## WO-369

Studio 9.9.449 production. 2,242 closed Houzz purchase orders no longer say Draft. Order status is Confirmed. Amounts were not changed. A vendor bill paid in full is Confirmed from now on. Hard refresh the purchase-order list.

## WO-367 and WO-368

Studio 9.9.448 production ~12:36. A variance charge line is named for the product. Under it: Original invoice INV-####. Amounts stay. PO numbers stay off. Hard refresh, then reopen the Cloud variance invoice.

## WO-366

Studio 9.9.447 production ~12:30. Opening the Cloud variance invoice removes PO-#### from the line title and description. Amounts stay. No QuickBooks push.

## Production 9.9.446

Cindy GO 2026-10-27 ~12:06. Hosting only. Live was 9.9.443. Now 9.9.446 at https://cch-platform.web.app. Includes WO-363, WO-364, and WO-365. She could not test a purchase order with many line items. Functions not deployed. No commit.

## WO-365

Studio 9.9.446 on staging. Confirm & invoiced fills Invoice date. The number arrows are off qty, price, pre-paid tax, and shipping. Production stays 9.9.443.

## WO-364

Studio 9.9.445 on staging. Mark as confirmed is the first card on the purchase order. The window keeps Save & mark confirmed and Confirm & invoiced at the top. Production stays 9.9.443.

## WO-363

Studio 9.9.444 on staging only. Receive vendor bill opens as the purchase-order lines. One row: quantity, price, pre-paid tax, shipping, note. Production stays 9.9.443.

## WO-362 and WO-361

- Studio 9.9.443. Follow-up: product invoice lines with no purchase order. Click the line for invoice, item, amount, paid date, and Create PO. Paid invoices are red. No PO is created by the count.
- Financial health labels 12–13px, notes 13px, needs-attention items 14px, amounts 16px. The row stacks when the window is under 1100px.
- WO-361: opening a draft variance invoice rewrites “PO PO-#### — Price increase” to the product or vendor. Amounts stay. Open INV-6086 after a hard refresh to reshape the draft.

## Verify

Hard refresh https://cch-platform-staging.web.app. Open Cloud Rolling Hills overview. Confirm the orange STAGING banner and Studio 9.9.442. Click POs / Bills for the reconciliation table.
