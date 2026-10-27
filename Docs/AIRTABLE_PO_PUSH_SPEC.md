# Airtable PO Push — Integration Spec

**Last updated:** June 19, 2026
**Last revised by:** Claude Code — created spec so Cursor can build the CCH Studio → Airtable PO push (Jun 19, 2026)

Purpose: push CCH Studio purchase orders (and their line items) into the **CCH Delivery Receiving** Airtable base so receivers/workrooms can check items in. Built by Claude Code; integration code owned by Cursor.

---

## Auth

Server-side push needs an Airtable **Personal Access Token** (PAT), not the chat OAuth session.
- Create at https://airtable.com/create/tokens
- Scopes: `data.records:read`, `data.records:write`
- Access: grant to the base `app8Je7Mpc81giBre` only
- Store as env var (e.g. `AIRTABLE_PAT`); never commit.

REST base URL: `https://api.airtable.com/v0/app8Je7Mpc81giBre/{tableId}`
Header: `Authorization: Bearer $AIRTABLE_PAT`, `Content-Type: application/json`

---

## Base & table IDs

- Base: `app8Je7Mpc81giBre`
- **Purchase Orders** table: `tblDclxZj88am7XMR`
- **Line Items** table: `tblT1Bjq0Ur09bd8J`

---

## Purchase Orders — field IDs

| Field | Field ID | Type | Notes |
|---|---|---|---|
| PO # | `fldATxqfNhq3CkpWK` | singleLineText | **upsert merge key** |
| Vendor (supplier) | `fldVn8PVjfmNBVAvd` | singleLineText | e.g. Visual Comfort |
| Ship to (receiver / workroom) | `fldQJbWEKb0Thi0fs` | singleLineText | receiving party — NOT the client |
| Client | `fldrQTqPYNGYcXj0l` | singleLineText | end client / project contact |
| Project | `fldsHArDlNKaiaqRZ` | singleSelect | options: Rolling Hills, 31 Whitesail, Bradbury-High, Bugle Trail / April Box, ELU Atelier, Other |
| Ship-to type | `fldjVFlumus08RBuc` | singleSelect | Window workroom, Receiver / warehouse, Custom upholstery, Furniture vendor, Lighting / ELU, Other |
| PO date | `fldTuecPtGcmhjDpT` | date | ISO `YYYY-MM-DD` |
| PO document | `fldrl2aRbayPNF5eq` | attachment | optional PO PDF: `[{ "url": "..." }]` |
| Overall status | `fldPxk2Iv884xWsJg` | singleSelect | Open, Partially received, Fully received, Closed |
| Notes | `fldBqWMJYZuS1j2zO` | multilineText | |

## Line Items — field IDs

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Item | `fldhmc70R3i1Bjcjt` | singleLineText | primary; title/name |
| Source key | `fldp8laWbTEisVqOT` | singleLineText | **upsert merge key** — `{poId}:{lineIndex}` or item id |
| Purchase Order | `fldIVNKXd1Yr2ZhmH` | link → Purchase Orders | value = `["recXXXX"]` of parent PO |
| Vendor | `fldJQrfjDKXC9mYpJ` | singleLineText | per-line vendor |
| SKU / model | `fldArHbF3WE6ru8fu` | singleLineText | sku/model/itemCode |
| Finish | `fldVWXlYQ9m4a5PkG` | singleLineText | |
| Room | `fldw8xlSuYFDrjkuv` | singleLineText | room/category |
| Qty ordered | `fldGgrCXP9uWehfUD` | number (int) | |
| Unit price | `fldPUjodTopCL9wUy` | currency | |
| Line total | `fldCRvnJNh44LVsQT` | formula | auto = Qty ordered × Unit price (do NOT write) |
| Product image | `fld5FahFNCB8uknrb` | attachment | reference photo: `[{ "url": "..." }]` |
| Qty received | `fldCZSej18Zpg8dRi` | number (int) | written by the receiver, not the push |
| Status | `fld6qNHLbv4TN0N1b` | singleSelect | Expected, Received complete, Partial, Damaged, Wrong item, Backordered |
| Condition | `fldbvM4Ig0sNfJUUe` | singleSelect | Good, Damaged, Needs inspection |
| Photo | `fld9w3S95M7EKZnwR` | attachment | received/condition photo (receiver) |
| Received by | `fldCVjTLRomvVAvoI` | singleLineText | receiver fills |
| Date received | `fldTvY1JS1jqCNpQi` | date | receiver fills |
| Remaining | `fldzWDR7eBmsGyCfn` | formula | auto = Qty ordered − Qty received (do NOT write) |

---

## Source → Airtable mapping

Firestore PO doc lives at `boards/{projectId}/purchaseOrders/{poId}`, line items in `po.items[]` (fallback `po.lineItems[]`). Field shapes confirmed in `platform/index.html` (lines ~8790–8818, 9628–9777).

**PO doc → Purchase Orders record**
- `poNumber || number` → PO #
- `vendor` → Vendor (supplier)
- (receiver) → Ship to (receiver / workroom) — *not on the PO; set per project/assignment*
- client / project contact → Client
- `projectName` → Project (map to a select option; use `typecast: true` or pre-map)
- `status` → Overall status (map DRAFT→Open, etc.)
- `date` → PO date
- on push set Overall status = Open if no receipts yet

**po.items[i] → Line Items record**
- `title || name` → Item
- `${poId}:${i}` (or `item.id` if stable) → Source key
- parent PO record id → Purchase Order (`["rec..."]`)
- `vendor` → Vendor
- `sku || model || itemCode` → SKU / model
- `finish` (confirm field name in data) → Finish
- `room || category` → Room
- `qty` → Qty ordered
- `cost || unitCost || costPrice` → Unit price
- `getProposalLineHeroImageUrl(item) || productImage || image || imageUrl` → Product image `[{url}]`
- leave Qty received / Status(default Expected) / Condition / Photo / Received by / Date received for the receiver

---

## Upsert (idempotent re-push)

Airtable supports upsert via `PATCH https://api.airtable.com/v0/{baseId}/{tableId}` with body:
```json
{ "performUpsert": { "fieldsToMergeOn": ["fldATxqfNhq3CkpWK"] }, "records": [ { "fields": { ... } } ], "typecast": true }
```
- **POs:** merge on PO # (`fldATxqfNhq3CkpWK`).
- **Line items:** merge on Source key (`fldp8laWbTEisVqOT`). Required — line titles repeat (e.g. 3× "Maverick 52\" Ceiling Fan").
- Order: upsert the PO first, capture its `recordId`, then upsert line items with the link set to that id.
- **Batch limit: 10 records per request.** Chunk line items in groups of ≤10.
- Attachment fields: pass `[{ "url": "https://..." }]`; Airtable fetches & stores. URL must be publicly reachable (Firebase Storage signed/public URL).

## Guardrails
- Push is **one-way** (CCH Studio → Airtable). Receiver-entered fields (Qty received, Status, Condition, Photo, Received by, Date received) are written only in Airtable — never overwrite them on re-push (don't include them in the upsert payload).
- Respect CLAUDE.md Rule #9: this runs from a context with legitimate read access to PO data; do not expose production Firestore creds to any browser/agent.
