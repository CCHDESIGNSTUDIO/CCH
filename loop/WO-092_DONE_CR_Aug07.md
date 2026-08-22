# WO-092 Part 1 DONE — Products picker display dedupe · CR Aug 07

**Scope:** Part 1 only (display collapse). Part 2/3 (create-path match + data merge) = **Code — not touched.**

## Grounding
- Products list: `_disLoadGlobalCatalog` in `platform/index.html` (~41495+)
- Prior doc-id-only dedupe in `ingestLibDoc`; twins with different ids still showed
- Project Selections already had `_disCollapsePickerClipsByProduct` — catalog path did not

## Change
1. `_disCatalogIdentityKey` / `_disCatalogKeepScore` / `_disCollapseCatalogByVendorSku`
2. Identity: `vendor|sku:…` when SKU present; else `vendor|title:…|p:price`
3. Keep best row (image → sell ≥ $1 → SKU → QB/category → prefer `productLibrary` → newer)
4. Called after both collections ingest, before sort; project clips untouched
5. `ingestLibDoc` stashes `_catalogColl`

## Build
Studio **9.9.107** / `wo092-picker-dedupe-2026-08-07`

## Verify (staging)
1. Proposal → Add item → Products
2. Search Long T / MIX / Urban — one row each
3. Distinct SKUs still separate; add still works; ON DOC / price intact
