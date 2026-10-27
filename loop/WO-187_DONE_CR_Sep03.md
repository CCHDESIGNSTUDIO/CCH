# WO-187 DONE — Project PO list: Vendor before Document tags

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-03  
**Asked by:** Cindy — Search Purchase Orders screenshot: Document tags sat left of Vendor.

## Grounding

- Project PO table (`#posTable`) headers at `platform/index.html:31724-31728`: Item, then Document tags, then Vendor.
- Matching cells at `:31765-31770`.
- Firm-wide `renderAllPOs` (`:73862-73865`) already paints PO #, Vendor, Project, Document Tags — not this surface.
- Sticky CSS (`#posTable th:nth-child(1|2)`) stays on checkbox + Item. Show Vendor still toggles `.po-vendor-col`.

## Change

Swapped Vendor and Document tags on the **project** PO list only (header + cells). No other columns, no print layer, no per-line Vendor on Edit.

## Files

- `platform/index.html` ~31726-31728 (thead), ~31765-31770 (tbody cells)
- `CCH_BUILD` 9.9.318 tag `po-list-vendor-before-tags-2026-09-03`

## Self-test

- Header order after Item: Vendor, then Document tags.
- Row cells match that order (Hubbardton Forge left of Additional Lighting).
- Show Vendor checkbox still hides `.po-vendor-col`.
- Merge selected / sticky Item column unchanged.

## Verify (after staging)

Project → Purchase Orders (Search purchase orders). Hard refresh. Columns: Item · Vendor · Document tags · PO status…
