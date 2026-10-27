# WO-163 DONE — Inspiration stars: bigger, visible on board lists, persist

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-08-31  
**Build:** Studio **9.9.306**

## Symptom (Cindy)

Tracey: stars not sticking. No stars on the boards main pages. Make the stars bigger. Screenshot: portal inspiration grid (Add your note / Activity on this image) with tiny outline stars.

## Surfaces

| Surface | This WO |
|---------|---------|
| Client portal inspiration board (images) | **Yes** |
| Client portal Inspirations list | **Yes** — ★ N starred on each board card |
| Studio Inspiration landing (`ib-p2-card`) | **Yes** — count now reads `feedback.stars`; gold pills larger |
| Studio board image grid (`ib-item-star-badge`) | **Yes** — larger badge; `?` restored to ★ |
| Print / PO / invoice | **No** |

## Grounding (this turn)

- Portal kill-all: `.cp-portal,.cp-portal * { border-radius:0 !important; box-shadow:none !important; }` at `index.html:77365` / `client.html:8810` — flattened 40px stars and stripped the drop shadow so they vanished on photos.
- Count badge only if `!_stOn && _starCnt > 0 && !_canInspStar` (`index.html:78104` before). Signed-in clients (Tracey) never saw ★1 even when activity listed a star.
- `_ibStarCountFromItem` (`index.html:11837`) required `_ibFeedbackShapeOk` (stars **and** comments arrays). Portal writes `feedback.stars` without a comments array → landing/list counted **0**.
- `_ibClientStarIndex` required `authorType === 'client'`. Email match failed when type was missing → toggle-off missed her row; reload showed empty star (“not sticking”).
- Studio caption badge used a literal `?` instead of ★ (`index.html:25433`).

## Change

1. Portal star button **56×56 / 32px** gold fill when on; restore `box-shadow` with `!important` so it wins over the portal flatten rule. Badge always shown when count > 0.
2. Inspirations list: `★ N starred` from `_ibSectionActivityCounts`.
3. Count `feedback.stars` whenever it is an array.
4. Match Tracey’s star by email (prefer `authorType: client`).
5. Persist star toggle in a Firestore transaction (no last-write-wins clobber).
6. Studio overlay/list stars larger; `?` → ★.

## Files

- `platform/index.html` CSS `:2148`, `:2284–2289`, `:2329–2334`, `:2718–2730`; counts `:11837–11845`; `_ibClientStarIndex` `:11886`; toggle transaction `:76084`; portal inject `:77365–77369`; image badge `:78113`; list `:78181`; `CCH_BUILD` 9.9.306
- `platform/client.html` same portal/count/toggle/list paths; added `_ibSectionActivityCounts`

## Verify (staging)

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **v9.9.306**
2. Studio → project Inspiration landing: boards with starred images show a gold ★ pill on the cover.
3. Open a board: gold ★ badge on the image is large; not a `?`.
4. Portal Inspirations list: board cards with stars show `★ N starred`.
5. Open a board: star control is large; gold fill when starred; ★ count next to it. Star, refresh — still filled.

**Staging hosted 2026-09-01 ~07:55** (Cindy GO). Close old tabs. Ctrl+Shift+R. Sidebar **v9.9.306**, orange STAGING banner.
