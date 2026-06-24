# Airtable ↔ Order Management Sync — Plan (for review)

**File:** AIRTABLE_ORDER_MGMT_SYNC_PLAN_CR_Jun22_v1.0.md
**Original Author:** Cursor (CR)
**Created:** June 22, 2026
**Last Modified:** June 23, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.1
**Status:** DRAFT — for Cynthia's review before any build

## Revision history

- v1.0 (June 22, 2026, CR): Initial. Aligns the Airtable receiving integration to the new **Order Management** page (`platform/cch-order-management.js`, build `20260602om11`). Grounded this session in `cch-order-management.js` and `cch-po-bill-variance.js`.
- v1.1 (June 23, 2026, CR): **Re-grounded to #2's newer commits** (`b1ec597` procurement lane · `10f44e3` bill lane · `4c3c9a4`/`d2ead06` shipping lane `shippingStatus` · `c5b328b`/`fd20d41` ship-status column + receiver check-in). Receiving is now a first-class **`shippingStatus`** lane (Pending→Shipped→Received), not just clip status; confirmations now have first-class fields (`orderConfNumber`, confirm date). Updated §1, §2, §3, §4, §6 accordingly. Added §7b nav decision (Receiving = own entity, built in `index.html`).

---

## GUARDRAIL (unchanged)

Internal + vendor / receiver / workroom only. **The client never sees anything PO-related.** No client access, views, forms, or notifications from this base.

---

## 1. What the Order Management page actually is (grounded)

`cch-order-management.js` is a firm-wide PO hub (Studio staff; not client guests; Houzz legacy imports excluded). It is the **single source of truth** the Airtable push should mirror, so Airtable and the page never disagree.

- **Data source:** `cchPoLoadAllPosForVendorBills()` — reads every board's `purchaseOrders` subcollection, dedupes by project + PO #. (`cch-po-bill-variance.js:322`)
- **Scope filter:** `cchOmIsHouzzPo(po)` excludes Houzz imports; only `cchOmIsStudioPo` POs appear. (`cch-order-management.js:48`)
- **Tabs:** Open POs · Missing ETA · Missing confirmations · Receiving status · Vendor bills · Bill variances · QuickBooks. (`:275`)

### The predicates we must match (so Airtable views agree with the page)

| Concept | Function | Definition (grounded) |
|---|---|---|
| Open PO | `cchOmIsOpenPo` (`:85`) | NOT received / cancelled / installed / paid / closed / delivered |
| Needs confirmation | `cchOmNeedsConfirmation` (`:118`) | sent to vendor AND no vendor ack (`hasVendorAck`) |
| Vendor ack | `hasVendorAck` (`:104`) | status ordered/shipped/partially received/at receiver/at workroom/delivered, OR a vendor-invoice row with `confirmedDate`/`orderConfirmation` |
| Missing ETA (line) | `lineMissingEta` (`:126`) | merch line with no `po.eta` and no line/group `etaDate`/`estimatedShipDate`/`confirmedDate`/`actualShipDate` |
| Receiving summary | `cchOmReceivingSummary` (`:1200`) | PO bucket from `shippingStatus`; per-line counts from linked clips |

### The three-lane status model (re-grounded Jun 23 — this is the big change)

Since v1.0, #2 split PO state into **three independent lanes** (commits `b1ec597`, `10f44e3`, `4c3c9a4`, `d2ead06`, `c5b328b`, `fd20d41`). This is the spine the Airtable sync must map to:

1. **Procurement lane** — `procurementStatus` (Sent to vendor → Waiting for confirmation → Confirmed). `cchPoProcurementLaneId`.
2. **Bill lane** — bill received / partial / complete + paid/balance (QuickBooks side).
3. **Shipping / receiving lane** — **`shippingStatus`** field, the canonical receiving status. `cchPoShippingStatus(doc, items)` (`cch-po-bill-variance.js:600`).

**Receiving is now a first-class `shippingStatus` lane, not just clip status.** `cchPoShippingStatus` resolves in order: explicit `doc.shippingStatus` → legacy `doc.status` (if a valid ship value) → inferred from ship-invoice groups (`cchPoInferShippingStatusFromGroups`, takes highest-ranked) → `Pending` if confirmed. Milestone chips (`cchPoShippingMilestoneIndex`): **0 Pending · 1 Shipped · 2 Received**.

Statuses (`CCH_PO_SHIPPING_STATUSES`, `:508`): Pending · Back ordered · Est. ship scheduled · Ordered · Shipped · In transit · Delivered · At Receiver *(needsLocation)* · At Workroom *(needsLocation)* · Received (goods in) · Installed · On Hold · Cancelled.

**There is already a receiver check-in UI in Studio:** editable ship-status dropdown on PO detail, All POs (ship-status column, CSV export), and the OM Receiving tab. Saving goes through `cchPoSaveShippingStatusFromSelect` → writes `shippingStatus` **and syncs linked FFE clips**. `cchOmSaveStatus` (`cch-order-management.js:1035`) is the OM entry point.

**OM Receiving is a hybrid:** the PO-level bucket comes from `shippingStatus` (`poShippingStatusForOm` → `cchPoShippingStatus`, `:1178`); the per-line received/in-transit/outstanding counts still come from linked clips' `orderStatus`. Both share `orderStatusBucket` (received/installed → received; shipped/in transit/delivered/at receiver/at workroom/partially received → intransit; else outstanding).

**Consequence for Airtable (revised):** the Airtable **Order status** should map to the PO-level **`shippingStatus`** (and per-line status where lines map to clips). Write-back (Phase 2) must target `shippingStatus` via the same path the check-in UI uses — `cchPoSaveShippingStatusFromSelect` — so clip sync and milestones stay consistent. Do **not** write clip `orderStatus` directly.

---

## 2. The core decision: one-way or two-way?

**Option A — One-way (push only).** Studio → Airtable. Receivers check in *inside Airtable*; Studio's Order Management Receiving tab does NOT reflect it (stays driven by clips). Simple, no write-back, no new Firestore writes. Risk: two systems drift — the office watches Airtable for receiving, the Receiving tab stays stale.

**Option B — Two-way (push + receiving write-back). [RECOMMENDED]** Studio → Airtable for POs/lines/bills/images; Airtable → Studio for **receiving only** (`shippingStatus`, qty received, condition, photos). Then the Order Management **Receiving tab reflects what receivers check in**, because it reads `shippingStatus` for the PO bucket.

Write-back is the higher-value path *because the page already keys on `shippingStatus`* — we'd be feeding the exact field its check-in UI writes. But it's also the bigger build (a sync-in job + conflict rules). Proposed phasing:

- **Phase 1 (now):** One-way push, aligned to OM predicates + the `shippingStatus` vocab (below). Receivers check in in Airtable. Validate on staging.
- **Phase 2 (next):** Receiving write-back — a scheduled/triggered job reads Airtable receiving fields and sets the PO's **`shippingStatus`** through the same logic as `cchPoSaveShippingStatusFromSelect` (which also syncs linked clips), so the Receiving tab + milestones match. One-way guardrail preserved: write-back only touches `shippingStatus` + receiver fields, never costs/categories. (Note: Studio *already* has its own check-in UI, so Phase 2 is only needed if receivers work primarily in Airtable rather than Studio.)

**→ Decision needed:** confirm Phase-1-now / Phase-2-next, or one-way only.

---

## 3. Status vocabulary alignment (do this regardless of A/B)

Airtable **Order status** single-select options must equal **`CCH_PO_SHIPPING_STATUSES`** (`cch-po-bill-variance.js:508`) so mapping to `orderStatusBucket` / milestones is lossless and round-trips cleanly:

| Airtable option | Milestone | Bucket (OM) |
|---|---|---|
| Pending | 0 Pending | outstanding |
| Back ordered | 0 Pending | outstanding |
| Est. ship scheduled | 0 Pending | outstanding |
| Ordered | 0 Pending | outstanding |
| Shipped | 1 Shipped | in transit |
| In transit | 1 Shipped | in transit |
| Delivered | 1 Shipped | in transit |
| At Receiver | 1 Shipped | in transit |
| At Workroom | 1 Shipped | in transit |
| Received (goods in) | 2 Received | received |
| Installed | 2 Received | received |
| On Hold | 0 Pending | outstanding |
| Cancelled | — | (excluded from open) |

For a **minimal receiver UX**, Airtable can expose just the 3 milestones (Pending → Shipped → Received) and map back to the full vocab on write. (Matches `CCH_PO_SHIPPING_STATUSES`, `cchPoShippingMilestoneIndex`, and `orderStatusBucket`.)

---

## 4. Fields to add to the push (to mirror OM columns)

The current push sends PO header + line items + images. To match what Order Management shows, add (read-only, office/receiver views):

**Purchase Orders table** (one field per lane — don't collapse them)
- **Procurement status** — `procurementStatus` (`cchPoProcurementLaneId`)
- **Shipping status** — `shippingStatus` (`cchPoShippingStatus`) — the receiving lane, vocab in §3
- **Bill status** — bill received/partial/complete + paid/balance
- **Order confirmation #** — `cchPoOrderConfNumber` (`:3903`) — now a first-class field
- **Confirmation date** — `cchOmPoConfirmDate`
- ETA — `po.eta` else `bill.etaDate`
- Needs confirmation? (computed by push, mirrors `cchOmNeedsConfirmation`)
- Receiving rollup — received / in-transit / outstanding / unlinked counts (Phase 2 can make these live rollups from Line Items)
- Location — `receiver || workroom || location || shipTo`
- Client name + Client email (internal reference only — guardrail)

**Line Items table**
- Order status (the §3 vocab) — drives the receiving buckets; sourced from linked clip `orderStatus` when present, else PO `shippingStatus`
- Storage location (receiver-owned; push never overwrites)
- ETA per line / group (`etaDate`, `estimatedShipDate`) via `cchPoLineEtaMetaForItem`

**Bills table** (per the companion spec) — confirmations + ship invoices, multi-per-PO.

---

## 5. Push parity rules (so Airtable == Order Management)

The Node push (`_scripts/push-pos-to-airtable_BY_CR_2026-06-19.js`) must:
1. **Exclude Houzz POs** — replicate `cchOmIsHouzzPo` (houzzImport flag, source contains "houzz", houzzBalance, houzz payment method).
2. **Use the same dedupe** (project + PO #) the page uses, to avoid pushing duplicate POs.
3. **Compute confirmation / open state with the same rules** so a "Needs confirmation" view in Airtable matches the page's tab.
4. Tag each line's status from the linked clip's `orderStatus` when available (same source the Receiving tab's per-line counts use), else the PO's **`shippingStatus`** (`cchPoShippingStatus`).

---

## 6. Where confirmations fit (ties to the in-progress feature)

The **Missing confirmations** tab clears a PO once it has vendor ack. Confirmations are now **first-class in OM**: an **Order conf #** column (`cchPoOrderConfNumber` / `cchOmSaveOrderConfNumber`) and a **Vendor confirmation date** column (`cchOmSaveConfirmDate`) already exist. The parked confirmation-upload feature (prompt on "Confirmed" → upload PDF/**image screenshot** of the web confirmation) should therefore **reuse `orderConfNumber`** rather than invent SO# storage, and attach the file to `bill.attachments[]` tagged `documentType:'confirmation'`. That file flows to the Airtable **Bills** table as a `confirmation` record. So uploading a confirmation in Studio both (a) clears the OM tab and (b) shows the confirmation in Airtable. Studio stays the office system of record for confirmations.

---

## 7. Open decisions for review

1. **One-way (A) vs two-way receiving write-back (B)?** Recommend B, phased (Phase 1 one-way now, Phase 2 write-back next).
2. **Receiving granularity:** per Line Item (recommended — matches clips) vs per PO.
3. **Receiver assignment** (still open from prior spec): manual link in Airtable / auto-match ship-to / new Studio field.
4. **Hide vs drop costs:** hide Unit price + Line total in receiver views (recommend hide; keep for office).
5. Confirm Airtable plan tier (automation run limits affect notifications at firm volume).

---

## 7b. Navigation / entry point — Airtable as its own entity (DECIDED Jun 23)

**Decision (supersedes the earlier "button under Order Management" idea):** Airtable is its **own top-level nav entity**, modeled exactly on **Order Builder** — a standalone `nav-item` link that opens the app in a new tab. It is a separate system (like Builder / work orders), not a sub-feature of Order Management.

- **Pattern to copy:** Order Builder (`index.html:3048`) — `<a class="nav-item" href="..." target="_blank" rel="noopener noreferrer">` with icon + label.
- **Link target:** the **Airtable base home** `https://airtable.com/app8Je7Mpc81giBre` (like Order Builder linking to `/builder/`, not a deep sub-page). You land in the base; Receivers / POs / Bills are all there.
- **No longer blocked on the Receivers table ID** — the entity link is the base home, so it can ship as soon as approved. (Deep links to specific views can be added later if wanted.)
- **Label/placement (BUILT Jun 23):** `📦 Receiving`, in the **Finance** section directly under Order Management. Implemented in `index.html` as an `<a class="nav-item" target="_blank">` to `https://airtable.com/app8Je7Mpc81giBre`. (Uncommitted — hand path to #1 for the coordinated commit.)
- **Guardrail:** internal/staff nav only; never exposed to client guests.

## 7c. Receiver column on PO + Order Management (BUILT Jun 23)

**Model (per Cynthia):** a PO is uploaded/sent **to a receiver**, so the receiver link lives on the **PO** (`po.receiver`); the **bill shows what shipped**. One source of truth, surfaced in two places; bill inherits/displays it.

**Built (uncommitted):**
- `cch-po-bill-variance.js` — new `window.cchPoLoadReceivers()` (caches receivers from Vendors `receiver/freight` + Team `role:receiver`), `cchPoReceiverOptionsHtml()`, `cchPoReceiverSelectHtml()`, `cchPoSaveReceiver()` (writes `po.receiver`, patches OM cache). Editable **Receiver** dropdown added to the **PO detail shipping lane** (both pre-confirm and active states).
- `cch-order-management.js` — OM **Receiving** tab "Location" column replaced with an editable **Receiver** dropdown (saves `po.receiver` in place).
- Reuses existing receiver data; no new Firestore schema. Per-shipment receiver override still deferred (§ uncommon split-shipment case).
- Both JS files pass `node --check`.

## 8. Build order once approved

1. Hermes builds Bills + Receivers tables, the new fields (§4), and the status options (§3); sends field IDs.
2. Cursor extends the push: Houzz exclusion + dedupe parity (§5), Bills/confirmations, receiving fields, status vocab. Validate on **staging**.
3. (Phase 2) Cursor builds receiving write-back → clip `orderStatus`; verify the OM Receiving tab reflects Airtable check-ins.
