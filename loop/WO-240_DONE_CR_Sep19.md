# WO-240 DONE — Tear sheets: no empty gray boxes; full product photo

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-19  
**Change ID:** 9.9.355

## Symptom

Cindy Sep 19 Cloud Rolling Hills medicine-cabinet tear sheets: Filmstrip 3A with two empty gray side boxes, and a second page whose hero is a giant gray rectangle (mirror glass cropped). Investment shows an em dash.

## Grounding

- Layout is 3A (`_tearSheetPageHtml3A` `index.html:16337`). Default image mode is **All images**.
- Strip always allocated **four** slots (`raw[1]||''` … `raw[4]||''`) and CSS `repeat(4,…)`. Empty URL → `#F1F1F0` placeholder (`_tearSheetCoverImg` `:16324`). WO-225 only hid the whole strip for Hero-only / zero extras — leftover empty boxes when a line has 1–3 extras.
- Hero CSS `object-fit:cover` + `height:100%` in a cell as tall as the 4-row strip crops a medicine-cabinet photo to the gray mirror glass. Classic tear sheets already use `contain`.
- Invoice path used to **overwrite** gallery hero with `getBestImageUrl` even when the line already had photos (`:17019`).
- Investment `—` is not a bug: `defaultTearSheetOpts().pricing` is **false** until **Pricing / Investment** is checked.

## Change

`platform/index.html` (tear-sheet popup CSS/HTML only):

1. 3A/3B strip: only real extra photos (max 4). Grid rows = count.
2. 3A/3B hero + thumbs: `object-fit:contain` (full product, letterbox on `#F1F1F0`).
3. Invoice hero: `getBestImageUrl` only if the gallery has no hero.
4. `CCH_BUILD` **9.9.355**.

## Surfaces

- **Intended:** Generate Tear Sheets window (proposal / invoice / clip) 3A and 3B.
- **Must not:** Proposal / invoice / PO Print-PDF Bill To / Ship To / line items. RFQ classic unchanged.

## Verify (staging)

Hard refresh staging **v9.9.355**. Rolling Hills invoice → Generate Tear Sheets → Filmstrip 3A → All images. Metal Beveled Inset Medicine Cabinet: no empty gray side boxes; hero shows the full cabinet/frame, not a gray crop. Hero only still full-width, no strip.

Print lock: **staging only**. No same-session production GO.
