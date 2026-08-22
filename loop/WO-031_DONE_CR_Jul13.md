# WO-031 DONE · Inspiration clip lightbox — Find similar (Google Lens) + price placeholder · CR Jul 13

**State:** DONE (production Jul 13 — Cindy GO)  
**Production:** https://cch-platform.web.app  
**Staging:** https://cch-platform-staging.web.app  
**File:** `platform/index.html` (ideabook clip lightbox)

## Shipped

### Find similar ↗ (reverse image search)
- `ibOpenClipFindSimilar(imgUrl)` — opens Google Lens `uploadbyurl` in new tab
- `_ibIsHostedClipImageUrl()` — button only when image is `http(s)` (not `data:`/`blob:`)
- Button in lightbox **Details → Source** row; gold highlight when clip has no `sourceUrl`
- Hint copy updated for unsourced Niice clips

### Price placeholder fix
- Empty price field placeholder: **"Price…"** (was "Client price…" clipped to "Client pri")
- Full meaning retained in `title` tooltip

## Verify (Cowork / Cindy)
1. Open inspiration board clip (hosted Firebase image) → **Find similar ↗** visible in lightbox
2. Click → Google Lens opens with that image; similar products appear
3. Clip with `data:`/`blob:` image → button hidden
4. Empty price field shows "Price…" not "Client pri"

### Hotfix (same day)
- **onclick quote collision** — Find similar / Open source buttons now use `cpPortalOnclickAttr()` (fixes `Unexpected end of input` when clicking with Niice/cloudfront URLs)

## Production
Deployed Jul 13 (Cindy GO) — https://cch-platform.web.app
