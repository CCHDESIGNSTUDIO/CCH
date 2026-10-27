# WO-216 DONE — Tear sheet 3A margin / clip

**Change ID:** 9.9.337  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9 staging: 3A is pretty; Faire Fancy Concrete sheet had margin errors — Dimensions / Room / Investment clipped, Application sitting apart from the other labels, hero and filmstrip bottoms not even.

## Diagnosis (file:line)

- `_tearSheetPageHtml3A` (`index.html` ~16316) pinned hero **594px** and thumbs **139px**. Page is 816px with `overflow:hidden`. A long Application value (Daso Bowl copy) made `.ts-3a-rail` taller than leftover space; footer and spec labels clipped.
- Rail used `align-items:end` (`_getTearSheetCSSRedesign` ~16745), so short columns (vendor, Dimensions, Room, Investment) dropped to the bottom of the tall Application cell.
- Strip math 4×139+3×12 = **592** vs hero **594**.

## Surfaces

| Intended | Must not |
|----------|----------|
| Generate Tear Sheets **3A** only | Proposal / invoice / PO Print |
| 3B full-bleed | RFQ classic sheets |

## Change

- Images fill leftover height (`flex:1; min-height:0`); hero and strip stretch to the same bottom.
- Rail `align-items:start`; Application/name line-clamp so the spec row cannot shove the footer off the page.
- Padding 40/40/32 so the header is not on the trim.

## Verify

Hard refresh staging. Sidebar **9.9.337**. Re-open Faire Fancy Concrete (or any 3A with a long Application). Labels on one row, *Designing Your Story…* visible, filmstrip bottom matches hero.
