# WO-046 · Request for Pricing (RFQ): from Selections, the Product Library, OR a Proposal, generate a vendor pricing request, email it, capture the quote back to confirm the proposal price · CW Jul 15
**Change ID:** pending #1 assign (RFQ) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.** New feature; net-new doc type but reuses existing engines.

## What Cindy asked (Jul 15)
"Select selections or items from the Product Library and create a request for pricing to send to a vendor." Delivery decision: **email** (vendor gets the request by email; prices are keyed back in manually). Purpose: **confirm the trade price on items BEFORE the proposal goes to the client**, so the proposal's numbers are real. It does **NOT** create a PO. Purchase orders remain a later step, after the client approves the proposal.

## Locked decisions (Cindy)
- **Delivery = email** the vendor (not a hosted quote-back portal). Prices come back by email/phone and are entered manually onto the items.
- **Group by vendor**: one RFQ per vendor (items already carry their vendor; never ask one vendor to price another's product).
- **Vendor never sees** client sell price, markup, or margin. Trade context only.
- **This is a proposal-pricing confirmation, NOT a PO.** An RFQ never creates or becomes a purchase order; it only firms up the cost the proposal is built on.
- New **RFQ-#### series** alongside the locked numbering (PRO-3000+, IN-10000+, PO-9000+, DOC-1000+). Suggest RFQ-1000+; confirm base with Cindy.

## Reuse (grounded, index.html)
- **Multi-select**: Selections already has checkbox multi-select + a bulk bar (`renderSelectionsTab` @14826/16240). Product Library has its own multi-select. Add a **"Request Pricing"** bulk action beside the existing bulk buttons on both surfaces.
- **Document layout = the tear-sheet engine in an RFQ mode**: `_tearSheetPageHtml` @14476, `showTearSheetOptionsDialog` @14610, `generateTearSheetsFromDoc` @14672. An RFQ sheet is a tear sheet with: product photo, name, SKU, dimensions, finish, **Qty**, a **"Needed by"** date, and an empty **"Vendor price / lead time"** column for them to fill; CCH header; NO client sell price / markup.
- **Vendor send path**: reuse the PO vendor-email module (`emailVendorPO` @67162 -> `window.cchPoEmailVendor`) and vendor-record resolution (`resolvePOVendorDisplay` @4826/:28517/:42445, `vendors` collection). Pull the vendor's email from the same record the PO emailer uses. If server-send isn't wired for RFQ, fall back to the tear-sheet email pattern (`tsEmailTearSheet` @78915: mailto + attach the generated PDF).
- **Quote-back attachment**: reuse the PO-attachment upload+register pattern (`addPOAttachment` @67168) to staple the vendor's returned quote (email/PDF) onto the RFQ.

## Change
1. **Bulk action "Request Pricing"** on Selections and Product Library multi-select. On click, gather the selected items, **auto-group by vendor**, and open the RFQ modal showing one group per vendor.
1b. **Proposal-level launch (Cindy Jul 15: "add it proposals too")**: on a proposal (Manage view), a **"Request Pricing"** action that targets the proposal's own product lines. Default the selection to lines whose confirmed cost is missing/zero (the ones actually needing a quote), but let her pick any lines. Same auto-group-by-vendor, same RFQ modal. This is the natural home for the feature since the purpose is confirming the proposal price. Proposal lines already carry room + vendor, so grouping and the linked-item write-back reuse the existing line->clip linkage (`clipId`). Skip header/labor/expense lines (`isProposalGroupHeaderItem` @8259).
2. **RFQ modal**: per vendor group, edit Qty, set a "Needed by" date, add a note; deselect any line; confirm the vendor's email (prefilled from the vendor record, editable). Product info is read-only (Master Library rule).
3. **Create RFQ doc(s)**: one per vendor, in a new `boards/{projectId}/rfqs` subcollection (from Selections = project-scoped; from the global Library with no project = standalone RFQ, optionally tagged to a project). Fields: `rfqNumber` (RFQ-####), `vendor`, `vendorEmail`, `status` (Draft), `neededBy`, `note`, `items[]` (each: title, sku, vendor, dimensions, finish, imageUrl, qty, `unitPriceQuoted:null`, `leadTimeQuoted:null`, source clip/library id). Status lifecycle: **Draft -> Sent -> Quoted -> Closed**.
4. **Generate the RFQ document** via the tear-sheet engine in RFQ mode (above) and **email it** to the vendor (PO-emailer path; mailto+PDF fallback). On send, set status Sent + `sentAt`.
5. **Capture the quote back (manual)**: on the RFQ detail, per line, enter `unitPriceQuoted` + `leadTimeQuoted`; attach the vendor's returned file (PO-attachment pattern). When all lines are priced, status -> Quoted.
6. **Confirm price onto the item (Cindy action, guarded)**: a "Use these prices" button writes the quoted unit price to the item's trade cost (`cost` / `costPrice`) on the linked clip/library product, so the **proposal's client price (cost x markup) is now confirmed** and ready to send to the client. This does **NOT** create a PO. Respect Master Library single-source rules + the document-isolation guards; write cost only, never client sell.
7. **Where to see RFQs**: an RFQ list (Finance/Procurement area) and, for a project, an RFQ tab; statuses color-coded like the rest of the app.

## Constraints
- Never split index.html. No native alert/confirm/prompt (styled modals). Escaped onclick attribute pattern (no quote-collision bug).
- Client-facing rules do NOT apply here (this is vendor-facing), but the RFQ sheet must still never expose client sell price / markup / margin.
- Reuse existing engines; do not fork a second tear-sheet renderer.

## Acceptance (binary)
1. Select 3 items across 2 vendors in Selections -> "Request Pricing" -> two RFQ drafts, one per vendor, each listing only that vendor's items with Qty + empty price column.
2. Same works from the Product Library multi-select (standalone RFQ when no project).
2b. From a proposal's "Request Pricing" action, the selection defaults to product lines missing a confirmed cost, groups by vendor, and produces the same RFQ drafts; the write-back lands on those proposal lines' linked items.
3. RFQ document generates with photo/name/SKU/dimensions/finish/qty, NO client price/markup, and emails to the vendor's address on file (or mailto+PDF fallback).
4. Entering quoted prices moves status to Quoted; "Use these prices" writes trade cost onto the linked item and the confirmed price shows up on the PROPOSAL (cost x markup). No PO is created.
5. RFQ-#### numbering is unique and sequential; status lifecycle Draft/Sent/Quoted/Closed works; no console errors.

## Verify (Claude, staging)
On a staging project: multi-select mixed-vendor items, create RFQs, generate + preview the vendor sheet (confirm no client pricing), simulate a quote-back, push prices, confirm the cost lands on the item and the proposal's client price updates (cost x markup), and that NO PO was created. Screenshot to loop/verify/WO-046/.

## Open sub-decisions (defaults chosen; Cindy can flip)
- RFQ number base: default RFQ-1000+.
- Library-sourced RFQ with no project: default standalone (optional project tag).
- Vendor email server-send vs mailto+PDF: use the PO-emailer if it server-sends; else mailto+PDF fallback (same as tear-sheet email today).

## DONE note
loop/WO-046_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
