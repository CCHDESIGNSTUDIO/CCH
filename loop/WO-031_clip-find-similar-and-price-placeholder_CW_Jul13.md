# WO-031 · Inspiration clip lightbox: "Find similar / Search the web" (reverse-image) button + fix the clipped "Client price…" placeholder · CW Jul 13
**Change ID:** pending #1 assign (IB) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html` clip lightbox. No schema change. **Staging first; prod on Cindy GO.**

## What Cindy said (Jul 13)
1. "Can we create a search internet for similar? We brought all the images over from Niice but the source link
   didn't come with them." → 65-clip boards full of images with no `sourceUrl`; needs a way to recover the source
   and find similar products from the image itself.
2. "Why does the $ say 'Client pri'?" → it's the empty Client-price field's placeholder being clipped, not a bug
   (see B).

## A. "Find similar / Search the web" (reverse image search)
### Grounding
Clip lightbox render @index.html:24645+. The image URL is `imgUrl` (used in the `<img>` @24650). The Source row
is @24684-24694; the "No source URL — paste a link…" hint is @24694. Detail panel section is where the button
belongs.
### Change
Add a button in the lightbox detail panel (next to Source / under the source hint) labeled **"Find similar ↗"**
(or "Search the web"). On click, open a reverse-image / visual search in a new tab using the clip's hosted image:
```
var q = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(imgUrl);
window.open(q, '_blank', 'noopener');
```
- **Only render the button when `imgUrl` is an http(s) URL** (Firebase Storage / hosted). Hide it for `data:` or
  `blob:` images (Lens can't fetch those).
- Primary = Google Lens (`lens.google.com/uploadbyurl`), best for "similar products." Acceptable fallback if
  Lens misbehaves: Google reverse image `https://www.google.com/searchbyimage?image_url=` + encoded url.
- Purpose in the hint copy: this recovers the missing source and finds similar items. When there's **no
  sourceUrl**, make it prominent (it's the main way back to a product); when a sourceUrl exists, keep it as a
  secondary "find similar" action.
- Privacy note: this sends the image URL to Google (vendor product images, non-sensitive) — fine. Do not send
  any client/project data, only the image URL.
### Phase 2 (note, don't build now)
A "sourcing helper" that steps through all unsourced clips on a board one at a time (Find similar → paste the
URL back into `sourceUrl`) so Cindy can rebuild the 65 lost Niice links quickly. Do NOT auto-open 65 tabs.

## B. Fix the clipped "Client price…" placeholder
### Grounding
@index.html:24668 the price input has `placeholder="Client price…"` in a `width:130px` field, so it visually
truncates to "Client pri". Value is empty when the clip has no price → the placeholder is all that shows.
### Change
Make it read cleanly: shorten the placeholder to **"Price…"** (keep the full `title` tooltip "Client price shown
to the client (never the trade cost)"), OR widen the input so "Client price…" isn't clipped. Prefer the shorter
placeholder — it reads better in the narrow field and the tooltip already carries the full meaning.

## Acceptance (binary)
1. Opening a clip with a hosted image shows a "Find similar ↗" button; clicking opens Google Lens visual search
   for that image in a new tab. Recovers a plausible source for an unsourced Niice clip.
2. Button is hidden when the clip image is a `data:`/`blob:` (non-hosted) URL.
3. The empty price field no longer reads as a stray "Client pri" label — it shows a clean placeholder that fits.
4. No console errors; index.html tail intact after edits.

## Verify (Claude, staging)
Open an unsourced Niice clip → click Find similar → confirm Lens opens with the image and returns similar
products. Confirm the price field reads cleanly when empty. Screenshot to loop/verify/WO-031/.

## DONE note
loop/WO-031_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
