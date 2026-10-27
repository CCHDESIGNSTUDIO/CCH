# WO-184 DONE — RFQ Request Pricing: fill SKU/finish/dims + images

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-03  
**Build:** Studio **9.9.316** (`rfq-sku-finish-img-2026-09-03`) · `cch-rfq.js?v=20260903rfq2`

## Symptom (Cindy)

Request Pricing modal (Roan & Iris vases/bowls): SKU and Finish columns were **—**, Dim under the name was **—**, and there were **no product images**. One line had SKU `6.60624`.

## Surfaces

| Surface | This WO |
|---------|---------|
| Proposal Options → Request Pricing modal | **Yes** |
| RFQ vendor preview sheet (`rfqMode`) | **Yes** — same hydrated SKU/finish/dims + hero image |
| Proposal Firestore lines | **No write-back** (document isolation) |
| Studio print (PO/invoice/proposal/tear client sheets) | **No** |

## Grounding (this turn)

- Modal helpers `rfqSku` / `rfqFinish` / `rfqDimensions` in `platform/cch-rfq.js:21–35` only read the proposal snapshot. They never called `cchFillLineItemFromClipMetadata` (`index.html:16014`) or clip/library image merge (`:15937`, `:13048`).
- Line editor already hydrates clip + library at `index.html:36509–36538` before showing SKU/Finish/Size.
- Tear sheets resolve images via `_tearSheetResolveLine` (`:16795`); RFQ preview passed a thin `fakeLine` with `imageUrl` only (`cch-rfq.js` former `:259–267`).
- Submit loop shadowed `var vi` (`former :177–179`), so vendor email / needed-by could miss the modal fields.

## Root cause

SKU, finish, dimensions, and photos often live on the **clip** or **Product Library**, not copied onto the proposal line. Request Pricing read the line only, so the vendor sheet showed dashes and no thumbs.

## Change

- Before drawing the modal: load clips for those lines, merge images, fill-empty SKU/finish/dims from clip + library (`rfqHydrateLine`). No proposal save.
- Also pick labeled SKU/Finish/Dimensions out of description text; PO-style dim lines via `cchPoSplitPrintDescription`.
- Thumbnail column on the modal; vendor sheet gets `imageUrl` + `images`.
- Fixed vendorNames draft assignment and the `vi` shadow in submit.

## Self-test

- `node --check platform\cch-rfq.js`
- `index.html` ends with `</html>`; `cch-rfq.js` ends with `})();`
- Grep: `cch-rfq.js?v=20260903rfq2`; `CCH_BUILD` 9.9.316

## Verify (after staging)

1. Ctrl+Shift+R — sidebar **v9.9.316**
2. Same proposal → Options → **Request Pricing**
3. Each line: photo (if the product has one), SKU, finish, dimensions from clip/library (not all **—** when those fields exist on the product)
4. Create drafts & preview — sheet shows image + SKU / Finish / Dimensions, no client sell
5. Confirm the proposal itself was not rewritten
