# Studio platform — release notes (2026-04-17)

Summary of shipped work in this push (Inspiration / Product Library / clipper UX, plus related platform files).

## Inspiration (Ideabooks) → Product Library → Proposals

- **Add to Product Library…** (image ⋮ menu): Opens the full **Add library item** modal prefilled from the tile (images, caption/title, vendor, pricing, notes, source URL, project).
- **Add to proposal…**: Creates a **`products`** catalog row first (or reuses one if the tile already has `libraryProductId`), then adds a proposal line with **`libraryProductId`** so pricing stays linked to the library like other catalog lines.
- **Ideabook image link**: After adding from proposal or after saving a **new** product from the library modal (opened from Inspiration), the ideabook `images[]` entry is updated with **`libraryProductId`** to avoid duplicate catalog rows on repeat actions.
- **`ibPatchIdeabookImageLibraryLink`**: Shared helper for writing that link; proposal confirm path and `saveProduct` (new `products.add`) both use it.

## Product Library modal (from Inspiration)

- **Clipper**: **Clipper** button next to **Open** on **Product website** — opens the URL from the field in a new tab with a short toast (workflow: run CCH Clipper on the vendor page, then update the form).
- Prefill / Firestore paths include **`sourceUrl`** (and related URL fields) so vendor pages from ideabook flow through correctly.

## Inspiration grid UX

- **⋮ menu visibility**: Kebab is always visible (with stronger hover / open state); **`@media (hover: none)`** keeps it visible on touch devices (previously `opacity: 0` until hover looked like missing actions).
- **Open source page**: ⋮ menu item when a product/vendor URL can be resolved from **`sourceUrl`**, **`pageUrl`**, **`productUrl`**, **`clippedFromUrl`**, **`link`**, **`houzzUrl`**, **`vendorUrl`**, **`canonicalUrl`**, or a non-image **`url`**.
- **`_ibResolveIdeabookProductPageUrl`** centralizes that resolution.

## Room Board → Inspiration (not a Clipper extension change)

- **Add from Room Board** picker: **`data-source`** now considers **`pageUrl`**, **`sourceUrl`**, **`productUrl`**, **`clippedFromUrl`**, **`link`**, **`houzzUrl`**, **`vendorUrl`** (previously only `pageUrl || sourceUrl`), so clips that store the vendor page on other fields keep the link on the inspiration tile.
- New tiles get both **`sourceUrl`** and **`pageUrl`** set from that value.
- **View details → Source URL** field shows the same expanded set; on save, **`pageUrl`** is synced with **`sourceUrl`** for consistency.

## `cch-proposals-invoices-fix.js`

- Documentation cross-reference to Inspiration / **`libraryProductId`** behavior in the main app.
- **`loadProjectVendors`**: Safer **`d.data() || {}`** when reading clips, vendors, and team (avoids throws on empty docs).
- **`index.html`**: Script cache query **`?v=1775800000000`** for this module.

## Other files in this commit

- **`platform/index.html`**: Large cumulative update (ideabooks, tear sheets, activity panel, CSS, etc. — see `git log` / diff for full detail).
- **`platform/cch-client-board.js`**, **`cch-design-board.js`**, **`cch-functions.js`**: Included in the same deployment batch; review `git diff` for line-level changes.

---

*Generated for internal release tracking. Commit on branch `master` in `cch-deploy`.*
