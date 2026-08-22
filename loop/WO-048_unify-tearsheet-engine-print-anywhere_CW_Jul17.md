# WO-048 · Unify ALL tear sheet buttons onto the redesigned engine + print a tear sheet from any product (Product Library detail) · CW Jul 17
**Change ID:** pending #1 assign (TS) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.** Fixes the WO-041 gap: the redesign only reached one path.

## What Cindy said (Jul 17, staging v9.8.81)
"I should be able to print a tear sheet from anywhere / product. Your tearsheet plan didn't work." She printed a tear sheet for "Peek Can" and got a full-bleed giant wood-grain image with a "CCH DESIGN INC. · Product Specification" header and no layout / no specs.

## Root cause (grounded, index.html)
There are TWO tear sheet generators:
- **Redesigned (WO-041, correct)**: `_tearSheetPageHtml` @14486 + `_getTearSheetCSSRedesign` @14505 + `_tearSheetImageHtml` @14170 (adaptive 1/2/3-4/5+). Header = `_tearSheetHeaderHtml` @14459 ("CCH Design"), footer "Designing Your Story…". Used only by the Proposals batch flow `generateTearSheetsFromDoc` @14682.
- **OLD (un-redesigned, broken)**: the "**Product Specification**" generator @79198 / @80420 — renders one giant full-bleed hero, no two-column layout, no spec grid. Reached by the `generateTearSheet` (singular) onclicks @9847 / @17645 / @20031 / @22370, `ibTearSheet` @22960/@23507, and the **"Tear Sheet" button in the Edit selection modal**. This is what Cindy hit.
So the redesign never reached the per-product / per-clip / ideabook / Product-Library print paths.

## Change
1. **Single engine.** Every tear sheet entry point routes through the redesigned `_tearSheetPageHtml` / `_getTearSheetCSSRedesign`. Retire the "Product Specification" generator (@79198/@80420) or make it a thin wrapper that builds `meta` + `opts` and calls `_tearSheetPageHtml`. No second renderer survives.
2. **Single-product meta builder.** For a product/clip/library item, assemble the same `meta` the proposal path uses (productName, vendor, room, description, dimensions, finishMaterial, sku, images[], pricing per opts) from the clip/library record. Reuse `_tearMetaFromClip` (or the closest existing meta builder) so one product prints the redesigned sheet.
3. **Print from anywhere — add the missing entry point.** Add a **"Tear Sheet"** action on the **Product Library product detail** page (screenshot 1: top-right by "Edit all fields" / "Delete"). Keep the existing "Tear Sheet" buttons on selections/clips/ideabook/design boards but re-point them at the unified engine. All open `showTearSheetOptionsDialog` (pricing on/off + fields) then render via `_generateTearSheetsFromDocRun`-style path adapted for a single item.
4. **Image containment guard.** A single huge hero must be contained, never full-bleed. The redesigned CSS already uses `object-fit:contain` in a fixed `.ts-page` (aspect-ratio 11/8.5, overflow hidden); add `.ts-hero{min-height:0;overflow:hidden;}` (and confirm `.ts-gallery`/`.ts-body` keep `min-height:0`) so a tall/large single image can't blow out the row. Verify with the exact Peek Can image that broke.
5. Keep landscape US Letter print rules (WO-041) and the pricing toggle. Never show trade cost / DNET on a client sheet.

## Acceptance (binary)
1. Printing a tear sheet from (a) a Product Library product, (b) a selection/room-board clip, (c) the ideabook, and (d) a proposal ALL produce the SAME redesigned sheet ("CCH Design" header, image-left / content-right, deduped spec grid, footer tagline). No "Product Specification" sheet remains anywhere.
2. The Peek Can product that broke now renders contained (image in its panel, name + specs visible), not a full-bleed giant.
3. A "Tear Sheet" action exists on the Product Library detail and works.
4. Pricing on/off still works; no client-forbidden data; landscape Letter print intact; no console errors.

## Verify (Claude, staging)
Print tear sheets for the same product from the Library detail, a clip, and a proposal; confirm identical redesigned output and that the previously-giant image is contained. Screenshots to loop/verify/WO-048/.

## DONE note
loop/WO-048_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
