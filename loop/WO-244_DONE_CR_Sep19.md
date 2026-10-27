# WO-244 DONE — Bill From: full Vendors list including Workrooms

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-19  
**Studio:** 9.9.358 `po-bill-from-vendors`

## Symptom

Cindy on West Avalon PO-9041 **Edit vendor bill**: Bill From could not pick **OC Custom Furniture** (workroom + ELU fabricator / showroom, same as Dana Creath / LA glass). Dropdown was showroom/retailer only; `category === 'Workroom'` was skipped.

## Grounding

- Picker: `cchPoBillFromPickerHtml` `platform/cch-po-bill-variance.js` ~2458
- Eligibility: `cchPoVendorBillFromEligible` ~3931 — Showroom / Retailer tags only
- Load: `cchPoLoadBillFromVendors` skipped `cat === 'Workroom'` (~3977 before this WO)
- Options: `cchPoBillFromOptionsHtml` dumped non-retailers into Showrooms, then duplicated “Other”
- Shared with Product Library showroom field (`index.html` ~68293)

## Surfaces

| Surface | This WO |
|---------|---------|
| Edit / Receive vendor bill **Bill from** | Yes — full Vendors list |
| Product Library showroomVendor select | Same helper — workrooms now listed |
| PO header / print Bill To / Ship To | Untouched |
| Delivery / Receiver vendors | Still excluded |

## Change

1. Every `vendors/` row except Delivery / Receiver appears in Bill From.
2. Groups: Showrooms · Workrooms · Retailers / online · Other vendors.
3. Workroom = category Workroom, type Workroom, `isWorkroom`, upholster/fabricat type or tags.
4. Hint copy says pick from Vendors (showroom, workroom, or retailer).

Cache `cch-po-bill-variance.js?v=20260919po244`. `CCH_BUILD` 9.9.358.

## Self-test

`node --check platform/cch-po-bill-variance.js` pass. File tail `})();` intact.

## Verify (staging)

Hard refresh staging PO-9041 (or any Elu PO) → Edit bill → Bill from → **Workrooms** → OC Custom Furniture. Save. Manufacturer on PO header stays Elu.
