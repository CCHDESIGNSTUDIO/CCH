# WO-046 PHASE 1 — Request for Pricing (SKU / finish / dimensions)

**State:** IN PROGRESS (Phase 1 only)  
**Executor:** Cursor  
**Date:** 2026-09-01  
**Build:** Studio **9.9.309**

## Cindy this turn

Include **SKU, finish, and dimensions** on the vendor request.

## Surfaces

| Surface | This phase |
|---------|------------|
| Proposal Options → **Request Pricing** | **Yes** |
| Vendor preview sheet (`opts.rfqMode`) | **Yes** — SKU / Finish / Dimensions always (— if empty); qty; needed by; blank vendor price. **No** sell / markup |
| Selections / Product Library bulk | **No** (later) |
| Quote-back / Use these prices | **No** (later) |
| Purchase orders | **Never** — RFQ does not create a PO |
| Client tear sheets / invoice / PO print | **No** — `rfqMode` only |

## Grounding

- Tear specs: `_tearSheetOptionalSectionsHtml` `index.html:16442` — SKU was **off** on default client tear sheets (`defaultTearSheetOpts.sku: false` `:16200`).
- Proposal meta: `_tearMetaFromProposalItem` `:16333`.
- Menu: `cchProposalMoreMenuWrap` `cch-proposals-invoices-fix.js:845`.
- Numbering: `_docNumberStartOffsets` now includes `RFQ: 999` → **RFQ-1000+**.
- Firestore: `boards/{projectId}/` had no `rfqs` match — writes would fail without `firestore.rules`.

## Change

1. Options **Request Pricing** on proposal view + edit.
2. Modal grouped by vendor; each line shows SKU, finish, dimensions, qty.
3. Draft docs in `boards/{projectId}/rfqs`.
4. Preview uses tear-sheet engine with `rfqMode: true`.
5. Mailto to vendor email (Print / PDF first).

## Files

- `platform/cch-rfq.js` (new)
- `platform/index.html` `CCH_BUILD` 9.9.309; tear `rfqMode`; RFQ counter; script `cch-rfq.js?v=20260901rfq1`
- `platform/cch-proposals-invoices-fix.js` menu; `?v=20260901rfq1`
- `platform/client.html` same `?v=` on shared fix.js
- `firestore.rules` `match /rfqs/{docId}` auth only

## Self-test

- `node --check platform\cch-rfq.js`
- `node --check platform\cch-proposals-invoices-fix.js`
- index.html ends with `</html>`

## Verify (after **hosting + firestore rules** staging)

1. Ctrl+Shift+R — sidebar **v9.9.309**
2. Open a proposal → Options → Request Pricing
3. Lines show SKU / finish / dimensions
4. Create drafts & preview — sheet has those three fields, no client price
5. Confirm **no PO** was created

## Still open on WO-046

Selections + Library launch, quote-back entry, Use these prices, RFQ list tab.
