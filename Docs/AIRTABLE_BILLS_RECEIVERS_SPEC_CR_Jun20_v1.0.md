# Airtable Bills + Receivers + Shipment Notification — Schema Spec

**File:** AIRTABLE_BILLS_RECEIVERS_SPEC_CR_Jun20_v1.0.md
**Original Author:** Cursor (CR)
**Created:** June 20, 2026
**Last Modified:** June 20, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.0

## Revision history

- v1.0 (June 20, 2026, CR): Initial. Companion to `AIRTABLE_PO_PUSH_SPEC.md`. Adds vendor bills/invoices (with tracking + PDFs), receivers, client email, storage location, and the "shipped → notify receiver" automation. Field shapes grounded in `platform/cch-po-bill-variance.js` and `platform/index.html` this session. Bills table covers **both vendor document types** — order confirmation / sales order (`documentType:'confirmation'`) and ship invoice (`documentType:'ship_invoice'`) — and many documents per PO (partial shipments); automation fires only on Ship invoice, never on confirmation.

---

## GUARDRAIL — the client never sees anything PO-related

This base and ALL of its notifications/forms/shared views are **internal + vendor / receiver / workroom-facing only**. The client must NEVER see purchase orders, vendor bills, costs, tracking, or receiving status.

- **No client access**, no client-facing shared views, no client-facing Forms, no client notifications from this base.
- **Client name + email are internal reference only** (so the office knows which project a PO belongs to). They are NEVER used to email the client and NEVER exposed in any externally shared view/form.
- Shipment/receiving notifications go to the **receiver only** — never the client.
- Cost fields (Unit price, Line total, Amount) are office-internal; hide from any external/receiver view.

---

## Purpose & division of labor

Extends the live PO push (CCH Delivery Receiving base `app8Je7Mpc81giBre`) so receivers/workrooms can: see what shipped, get the vendor invoice PDFs + tracking, get an email when an item ships, and check items in with minimal effort.

- **Schema (this spec) = Hermes/Claude Code** builds the tables/fields/automation in Airtable, then sends Cursor the table IDs + field IDs.
- **Integration code = Cursor** extends the push script to populate them once IDs exist. (Cursor will NOT code against unknown field IDs — same lesson as the PO push: a wrong/absent field ID throws a 403.)

---

## A. New field on the existing Purchase Orders table

| Field | Type | Source (Firestore) | Notes |
|---|---|---|---|
| Client email | singleLineText (or email) | `board.clientEmail` | Per project; PO inherits its project's client email. Reference/confirmation. |
| Receiver | link → Receivers (table C) | see "Receiver assignment" below | Drives the shipment notification. |

(Ship to address already exists as `fldQJbWEKb0Thi0fs`; Cursor now maps real `po.shipTo` addresses into it — the junk-"client" filter only blanks literal client echoes.)

## B. New table: Bills (vendor documents — confirmations + ship invoices)

One record **per vendor document**, all linked to their PO. The platform already models **two document types** in one stream (`vendorInvoiceGroups[].documentType`):

1. **Order confirmation / sales order** (`documentType: 'confirmation'`) — vendor acknowledges the PO after we send it. Carries a **sales order #**, **estimated freight**, optional **confirmed/est-ship dates**, and back-order lines. *No tracking yet — they don't invoice until it ships.* We pay or put a CC on file at this stage.
2. **Ship invoice** (`documentType: 'ship_invoice'`) — issued when the vendor actually **ships and charges the CC**. Carries the **vendor invoice #**, **actual freight**, **tracking #/carrier**, **actual ship date**, and ETA.

**A single PO routinely has multiple documents** — one confirmation plus several ship invoices for partial shipments (e.g. PO-9017 has 3 ship invoices). Each ship invoice covers only *some* of the PO's lines and ships separately, so **tracking/ETA/status live per Bill record, not per PO.**

Source: Firestore `boards/{projectId}/purchaseOrders/{poId}` — primarily `vendorInvoiceGroups[]` (the canonical per-document model), with `bill.attachments[]` for PDFs and `bill.billTotal` as a fallback amount.

| Field | Type | Source from PO doc | Notes |
|---|---|---|---|
| Reference # | singleLineText (primary) | SO# for confirmations, vendor inv # for ship invoices (`cchPoVendorInvRefLabel(g)`: `salesOrderNumber` else `vendorInvoiceNumber`) | may be blank ("No Invoice #") |
| Document type | singleSelect | `vendorInvoiceGroups[].documentType` | Options: **Order confirmation**, **Ship invoice** |
| Source key | singleLineText | `{poId}:{documentType}:{salesOrderNumber || vendorInvoiceNumber || row.id || index}` | **upsert merge key** (idempotent). Type + fallback to id/index so a confirmation and a same-numbered invoice, or multiple blank-numbered docs, don't collide. |
| Purchase Order | link → Purchase Orders | match on PO # | many Bills → one PO |
| Vendor | singleLineText | `po.vendor` | |
| Sales order # | singleLineText | `vendorInvoiceGroups[].salesOrderNumber` | confirmations |
| Invoice # | singleLineText | `vendorInvoiceGroups[].vendorInvoiceNumber` | ship invoices |
| Document date | date | `confirmedDate` (confirmation) else `vendorInvoiceDate` | |
| Amount | currency | row `amount` / `bill.billTotal` | per-document amount |
| Est. freight | currency | `vendorInvoiceGroups[].estimatedFreight` | on confirmation |
| Actual freight | currency | `vendorInvoiceGroups[].actualFreight` | on ship invoice |
| Covers lines | long text (or link → Line Items) | `vendorInvoiceGroups[].poLineIds` | which PO lines this document/shipment covers (partial shipments / back-orders) |
| Confirmed date | date | `vendorInvoiceGroups[].confirmedDate` | confirmation |
| Est. ship date | date | `vendorInvoiceGroups[].estimatedShipDate` | |
| Actual ship date | date | `vendorInvoiceGroups[].actualShipDate` | ship invoice — triggers "shipped" notification |
| Tracking carrier | singleLineText | `vendorInvoiceGroups[].trackingCarrier` | ship invoice |
| Tracking # | singleLineText | `vendorInvoiceGroups[].trackingNumber` | ship invoice |
| ETA / delivery | date | `vendorInvoiceGroups[].etaDate` | |
| Order status | singleSelect | order status | Options: Ordered, Shipped, Delivered, Backordered |
| Notes | long text | `shipmentNotes` / description | |
| Document file | **attachment** | `bill.attachments[].url` | Firebase Storage download URLs — Airtable fetches by URL (no local upload). Matched to this document via `attachment.vendorInvoiceNumber` when tagged; untagged attachments go to the PO's first/primary document. |

## C. New table: Receivers

Source: `vendors` collection where category is `Delivery / Receiver` / `Freight / Receiver` or `type === 'receiver'` / `isReceiver`, plus `team` where `role === 'receiver'`. Each has contact + email.

**Organizing principle (per Cynthia, Jun 24): the receiving view is BY RECEIVER — one Receiver record links to ALL the POs sent to them.** This is the same model as the new Studio **Receivers page** (`renderDeliveryReceivers`, grouped by `po.receiver`). In Airtable it's a one-to-many link: Receiver → Purchase Orders.

| Field | Type | Source | Notes |
|---|---|---|---|
| Name | singleLineText (primary) | `name` / `company` | |
| Source key | singleLineText | vendor/team doc id | upsert merge key |
| Contact | singleLineText | `contact` / `contactName` / `rep` | |
| Email | email | `email` / `contactEmail` | drives the notification |
| Phone | singleLineText | `phone` | |
| Address | singleLineText | `address` | |
| **Purchase Orders** | **link → Purchase Orders** (many) | set from PO's Receiver link (PO's `po.receiver` matches this Name) | the "all POs sent to this receiver" list — gives the by-receiver grouped view |
| PO count | rollup/count of Purchase Orders | — | optional convenience |

**Required companion field on the Purchase Orders table:** a **Receiver** link → Receivers (single), set by the push from `po.receiver`. The Receivers→POs link is the reverse of this. A grouped view of Purchase Orders **grouped by Receiver** then reproduces the Studio Receivers page inside Airtable.

## D. New field on Line Items table (receiver-owned)

| Field | Type | Notes |
|---|---|---|
| Storage location | singleLineText (or singleSelect) | Where the receiver physically put it (e.g. "Bin A3", "Workroom"). **Receiver-entered — the push NEVER writes it** (one-way guardrail). |

## E. Receiver assignment (open decision)

The PO data does not reliably name the receiver (ship-to was historically junk). Pick one:
1. **Receiver link set in Airtable per PO** (dropdown) — simplest, no code.
2. **Auto-match** PO `shipTo` address/name to a Receivers record — Cursor can attempt this if ship-to text reliably matches a receiver name.
3. **Add a Receiver field on the PO in Studio**, then Cursor pushes the link.

Default recommendation: option 1 to start; revisit auto-match once real ship-to addresses are populated.

## F. Automation: shipped → notify receiver

Built in Airtable Automations (UI; not scriptable via API):
- **Trigger:** a Bills record where **Document type = Ship invoice** AND (Order status becomes **Shipped** OR a **Tracking #** / **Actual ship date** is added). **Order confirmations must NOT trigger a shipment email** — the vendor hasn't shipped at confirmation time.
- **Action:** send email to the linked **Receiver.Email**: item(s), vendor, carrier + tracking #, ETA, and a link to confirm receipt.
- Free plan allows only 100 automation runs/month; Team plan = 25,000 (relevant at firm-wide volume).

## G. Receiver-facing view/Form (minimal friction)

- Hide **Unit price** and **Line total** from the receiver view (kept for the office in an internal view). *(Alternatively Cursor drops them from the push entirely — pending Cynthia's choice.)*
- Receiver sees: Item + product image + Qty ordered; fills only **Received? / Qty received / Condition / Photo / Storage location**.
- Works in the Airtable iOS/iPad app (camera → photo straight onto the record) or a no-login Form link.

---

## What Cursor will push once the schema exists

Given table IDs + field IDs for B, C, and the new fields in A/D, Cursor extends `_scripts/push-pos-to-airtable_BY_CR_2026-06-19.js` (or a companion) to populate: Client email, Ship-to address, Bills (vendor invoices + tracking + PDF URLs), Receivers, and the PO→Receiver link (per chosen assignment method). Receiver-owned fields (Storage location, Received*, Condition, Photo, Date received) are never written.
