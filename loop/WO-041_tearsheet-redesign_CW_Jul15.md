# WO-041 · Tear sheet redesign, photo-led landscape sheet for the client portal (deduped specs, adaptive image grid, print-accurate US Letter) · CW Jul 15
**Change ID:** pending #1 assign (INV/PORTAL) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html` (tear sheet generator + CSS). **Staging first; prod on Cindy GO.**

## Why / what Cindy said (Jul 15)
Tear sheets are going on the client portal and read like a spec dump, not "a gift." Defects flagged, confirmed in code:
- **Description is a spec dump.** On Holtz Hill lines the `description` field holds dimensions + materials + lightsource, then Dimensions and Finish/Material print AGAIN below (e.g. "Gild" twice). `_tearSheetOptionalSectionsHtml` (@13957) renders every field as an identical tiny grey block, no dedup.
- **No hierarchy.** Product name and room are equal weight (`_tearSheetCaptionRow` @13937); specs are 9-10px grey. Brand rule (cch-marketing): photography leads, understated hierarchy.
- **Wasted space.** `.ts-stage` locked at 4.15in band (`_getTearSheetCSSRedesign` @14020) → tall fixtures float in white, lower half of page empty.
- **Warm/tan tone.** Cindy: crisp WHITE only, especially for printing.

Direction locked over 8 mockup iterations. BUILD TO THE REFERENCE FILES in this folder:
`WO-041_MOCKUP_tearsheet_landscape_CW_Jul15.html` (two products, pricing on + off) and `WO-041_MOCKUP_lyla_example_CW_Jul15.html` (real Arhaus library data).

## Grounding (confirmed, index.html)
- Meta builders: `_tearMetaFromProposalItem` @13852, `_tearMetaFromClip` @13784, `_tearMetaFromInvoiceItem` @13806, `_tearMetaFromDesignEl` @13879, `_tearMetaFromIdeabookItem` @13899. Each returns {productName, vendor, room, description, additionalDetails, additionalNotes, internalNotes, sku, dimensions, finishMaterial, pricingQty/Unit/Total}. Vendor already carried → bind the vendor line to it, blank when empty (RESOLVED: e.g. Lyla → "Arhaus"; no guessing).
- Options: `defaultTearSheetOpts` @13767, `readTearSheetOptsFromForm` @14099, `showTearSheetOptionsDialog` @14126.
- Render chain: `_tearSheetPageHtml` @14005 → `_tearSheetHeaderHtml` @13994 + `_tearSheetImageHtml` @13730 + `_tearSheetCaptionRow` @13937 + `_tearSheetOptionalSectionsHtml` @13957 + footer @14001.
- `_tearSheetImageHtml` @13730 today: 0→empty; 1 (or hero mode)→single contained-centered (FLOATS in white); >=2→grid hero-cell(3fr)+extras-col(2fr), extras sliced [1,6).

## Change, rebuild these pieces to the mockup
**1. Two-column layout (image-left / content-right)**, replacing image-top/specs-below. In `_tearSheetPageHtml`, image stage and content (caption + optional sections + pricing) side by side in the page body. Split image ~64-68% / content ~32-36% (mockup grid 2.15fr / 1fr). Header full-width top, footer full-width bottom.

**2. Content header (replaces `_tearSheetCaptionRow`).** Move the ROOM up into the HEADER top strip, inline right with project and date (single line), as a small gold-outline tag (~6.5px); collapse the header band tight (~7px padding, align-items center). The CONTENT column then LEADS with the product name (Playfair ~14px), vendor beneath (~7.5px uppercase navy-soft); no room tag in the content column. When room is blank (e.g. Product Library item), use category or omit the tag, never render an empty box.

**3. Optional sections (rewrite `_tearSheetOptionalSectionsHtml`):**
   - **Description**: short editorial line off `description`, ~8px muted navy. NOT a spec table. **DEDUP GUARD:** before rendering Dimensions/Finish, if `description` already contains the dimensions or finishMaterial text (normalized compare), strip those fragments from the description (or suppress a description that is purely spec text) so nothing prints twice.
   - **Spec grid**: single-column stacked list (narrow rail), gold ~6.5px uppercase labels + navy ~8px values. Dimensions (full-width row), then Finish, Light source / SKU each on its own row. Render a cell ONLY when its value exists.
   - **Pricing**: a stacked block, "Investment" label with the values beneath it ("Qty N · $X each · $Y total") so it fits the narrow rail, only when `opts.pricing` AND a client sell price exists. **NEVER render trade cost / DNET / markup.** Off by default for docs with no client sell price (library / trade-only).

**4. Adaptive image grid (rewrite `_tearSheetImageHtml`), Cindy's explicit ask:**
   - **1 image**: hero fills the ENTIRE image area (single column, no thumb rail); large, contain, centered, edge-to-edge of the image side. No floating in a narrow band.
   - **2 images**: hero + ONE companion image filling the side (not a lonely small thumbnail); balanced.
   - **3-4 images**: hero (large) + a rail of 2-3 stacked thumbnails.
   - **5+**: hero + up to 4 thumbnails; cap the rest, no overflow.
   - Honor `imageMode:'hero'` = force single hero regardless of count. Keep the existing src-allow, dedup, referrerpolicy, and `cchImgTryFallbacks` error handling.

**5. CSS (rewrite `_getTearSheetCSSRedesign`) to the mockup:**
   - **Crisp WHITE only**, no tan/beige anywhere. Paper #FFFFFF; screen backdrop cool grey #E9EBEE; hairlines cool grey #E2E4E8. Gold #B08D4C as a thin accent only (room tag, spec labels, tagline).
   - Type scale (final, from the locked mockup): logo 17px/0.30em; name 14px Playfair 600; vendor 7.5px; description 8px; spec label 6.5px; spec value 8px; pricing label 6.5px / value 8.5px. Small, understated (matched to the StyleRow reference Cindy set).
   - Header band collapsed tight (~7px padding); ROOM tag lives in the header meta cluster (top-right, inline with project and date). Footer: "Designing Your Story…" italic gold + "Confidential · CCH Design Inc.". Thumbnail rail ~132px.
   - **Print = landscape US Letter**: `@page{size:11in 8.5in;margin:0.3in;}`; each sheet fills the printable area (~7.9in tall), one product per page (`page-break-after:always`), screen/toolbar chrome hidden in `@media print`.

## Constraints
- Never split index.html. No native alert/confirm/prompt. Escaped onclick attribute pattern for any handlers (do NOT reintroduce the quote-collision bug).
- Display-only: stored line/proposal data unchanged. Rendering + options only.
- Client-facing (cch-client-portal + cch-marketing): financials secondary; never cost/DNET/markup; client sell price only when pricing is on.

## Acceptance (binary)
1. Proposal tear sheet renders image-left / content-right, crisp white, name leading in Playfair, room as a gold tag, vendor bound to the record (blank when empty).
2. Specs are a deduped grid, a value in the description does NOT also print as its own block ("Gild" once, dims once).
3. Image area adapts: 1 fills the frame; 2 balance; 3-4 hero + rail; 5+ capped. No vertical fixture floating in a white band.
4. Pricing shows only with `opts.pricing` + a client sell price, as one quiet line; trade cost/DNET never appears; pricing-off omits the line cleanly.
5. Prints landscape US Letter (11x8.5), one product per page, filling the page, chrome hidden. Matches the reference mockup.
6. No console errors; no regression to the "Generate tear sheets" dialog/flow.

## Verify (Claude, staging)
Generate tear sheets on a staging proposal with mixed image counts (1, 2, 4) and a retainer/discount line; confirm layout, dedup, adaptivity, pricing on/off, and print. Screenshot to loop/verify/WO-041/.

## DONE note
loop/WO-041_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
