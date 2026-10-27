# WO-164 DONE — Studio Inspiration: star + comment on every tile

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-01  
**Build:** Studio **9.9.307**

## Symptom (Cindy)

Staging Inspiration for Cloud Rolling Hills (v9.9.306): photos have ⋯ menus and comments under some images, **no stars on the tiles**. "NOOOOOO stars."

## Surfaces

| Surface | This WO |
|---------|---------|
| Studio Inspiration **board image grid** (`ib-item`) | **Yes** — always-on star + comment cloud on the photo |
| Client portal inspiration tiles | **No** (already had overlay in 9.9.306) |
| Studio Inspiration landing cards (`ib-p2-card`) | **No** |
| Print / PO / invoice | **No** |

## Grounding (this turn)

- Studio tile HTML at `index.html:25414` (before) only painted `.ib-item-star-badge` when `_ibStarCountFromItem(item) > 0`. Unstarred images had **no star on the photo**.
- Star / comment for Studio lived in the kebab: `ibToggleStar` `index.html:25428`, `ibQuickComment` `index.html:25429`.
- CSS `.ib-item-hover-actions` existed (`index.html:2165`) with **no HTML** using that class.
- Portal already renders always-on `.cp-insp-star-btn` / `.cp-insp-comment-btn` (`index.html:78112–78116`).
- `_ibStarCountFromItem` `index.html:11837` counts `feedback.stars` arrays. Empty array = 0 = no badge. That is why a board with comments but no stars looked star-less.

## Change

1. Every Studio tile gets a **48×48 star button** bottom-left (outline ★ when off, gold fill when this designer has starred). Count chip next to it when anyone has starred.
2. Every Studio tile gets a **comment cloud** bottom-right (count when comments exist). Calls existing `ibQuickComment`.
3. Product-library diamond moved **top-left** so it does not sit on the star.
4. Overlay controls hidden in Select mode.
5. `CCH_BUILD` **9.9.307**.

## Files

- `platform/index.html` CSS `:2283–2320`, `:2612–2615`; tile vars `:25356–25359`; overlay HTML `:25417–25425`; `CCH_BUILD` `:4367`

## Self-test

- Tile template always emits `.ib-item-star-btn` (not gated on `starCount > 0`).
- File tail still `</html>`.
- No `cch-*.js` change (no `?v=` bump).

**Staging hosted 2026-09-01 ~10:33.** Close old tabs. Ctrl+Shift+R. Sidebar **v9.9.307**, orange STAGING banner.
