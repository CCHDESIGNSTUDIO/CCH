# SHIPPED — DO NOT RE-IMPLEMENT

**Original WO (field carry on copy-to-room) shipped** as Studio **9.9.228**, bundled staging **9.9.230** (2026-08-20 ~07:40) and production **9.9.234** (Cindy GO ~10:26).

Do **not** rebuild `_clipRow` in `_disPersistAppendedRows`. Live code already carries `images[]`, spec/product URLs, manufacturer, client title/description, finish/materials/dimensions/notes, and `clientPrice` via `parseMoney` (`platform/index.html:41976–42011`). Tile remap `'Tile & Stone' → 'Stone & Tile'` is already in `cch-product-categories.js`.

---

## Follow-up (this rewrite) — remap no longer kicks MASTER categories off the list

**CR_Aug20_v1.1** · Lane: **Cursor** · Files: `platform/cch-product-categories.js`, `platform/index.html` (cache buster + 9.9.235), `platform/builder/index.html` (Builder twin table) · **Staging first; prod on Cindy GO.**

Copy-to-room runs `cchResolveSingleProductCategory` (`index.html:41973`). The old remap rewrote **valid MASTER** values to labels that are **not** on MASTER:

| Input (valid) | Was rewritten to (invalid) |
|---|---|
| Floor Covering | Flooring |
| Florals | Accessories |
| Wall | Wall Covering |
| Appliances & Plumbing (double-space / Kitchen and Bath aliases) | Plumbing & Appliances |

### Change (already in tree as 9.9.235)

1. `_normalizeSingleCategorySegment` returns a MASTER match **before** remap (`cch-product-categories.js:108`).
2. Remap only heals **legacy** labels **toward** MASTER (`Flooring` → Floor Covering, `Tile & Stone` → Stone & Tile, `Plumbing & Appliances` → Appliances & Plumbing). Identity no-ops for Cabinet/Window Hardware left in place.
3. Builder `BUILDER_LIBRARY_CAT_NORM` aligned the same way (it still had `Stone & Tile` → `Tile & Stone`).

No Firestore walk. No `_clipRow` rewrite. No isolation change.

### Verify (staging)

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **9.9.235**
2. Copy a **Stone & Tile** library item into a room → category stays **Stone & Tile** (still valid).
3. Copy a **Floor Covering**, **Florals**, or **Wall** item into a room → category stays that MASTER label (no “not valid”).
4. A legacy **Tile & Stone** or **Flooring** label still remaps to Stone & Tile / Floor Covering.

### Production

Cindy GO after staging eyeball. Hosting only (`cch-product-categories.js` + `index.html` + builder). No functions.
