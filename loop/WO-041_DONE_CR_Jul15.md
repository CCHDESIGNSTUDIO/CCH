# WO-041 DONE — Tear sheet landscape redesign · Jul 15, 2026

**Build:** v9.8.64 (`tearsheet-landscape-redesign-2026-07-15`)  
**Staging:** https://cch-platform-staging.web.app  
**Production:** NOT deployed (staging only per WO)

## Summary

Rebuilt the tear sheet generator to match the locked mockups (`loop/WO-041_MOCKUP_tearsheet_landscape_CW_Jul15.html`, `loop/WO-041_MOCKUP_lyla_example_CW_Jul15.html`):

- **Layout:** Image-left / content-right (`2.15fr / 1fr`), full-width header + footer
- **Header:** Collapsed band; room as gold-outline tag inline with project + date (category fallback when room blank)
- **Content:** Playfair product name (14px), vendor beneath (from record only), editorial description with dedup guard
- **Specs:** Single-column gold-label grid — Dimensions, Finish, Light source, SKU — no duplicate spec text from description
- **Pricing:** Stacked "Investment" block; client sell only (removed ideabook `cost` fallback); never trade cost / DNET
- **Images:** Adaptive grid — 1 fills frame, 2 balanced, 3–4 hero+rail (132px), 5+ capped at 4 thumbs; hero mode forces single
- **CSS:** Crisp white paper, cool grey backdrop/lines, landscape US Letter print (`11×8.5`, 7.9in sheet height)

## Files changed

- `platform/index.html` — `_tearSheetImageHtml`, `_tearSheetCaptionRow`, `_tearSheetOptionalSectionsHtml`, `_tearSheetHeaderHtml`, `_tearSheetFooterHtml`, `_tearSheetPageHtml`, `_getTearSheetCSSRedesign`; meta helpers + dedup utilities; `CCH_BUILD` → 9.8.64

## Deploy

```bash
firebase deploy --only hosting:platform --project staging
```

## Smoke (Claude verify)

1. Proposal tear sheets — mixed image counts (1, 2, 4); pricing on + off
2. Holtz Hill lighting line — confirm "Gild" / dims appear once (dedup)
3. Product Library item (e.g. Lyla) — vendor from record, pricing off, category/room tag
4. Print preview — landscape US Letter, one product per page, toolbar hidden

Screenshots → `loop/verify/WO-041/`
