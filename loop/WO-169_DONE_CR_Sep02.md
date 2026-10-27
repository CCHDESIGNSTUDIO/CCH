# WO-169 DONE — Builder: Vendor name stays when Source = Vendor

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo169-vendor-keep** (not a Studio `CCH_BUILD` bump)

## Symptom (Cindy)

GRE-W-05 Material A — ROLLER FABRIC: Vendor/manufacturer name (e.g. Lutron) **disappears** when Source is switched from COM to **Vendor**. Form also jumped to the top.

## Surfaces

| Surface | This WO |
|---------|---------|
| Custom Order Builder (`platform/builder/index.html`) Materials rows | **Yes** |
| Shade Face Lutron block | Unchanged (already has Manufacturer) |
| Studio proposals / invoices / POs / print | **No** |

## Grounding (this turn)

- COM branch had `field("Vendor")` at former `:11869`; Vendor branch (`isVendor`) had Part # / color / swatch only (`:11873–11886`).
- Preview `buildPreviewFabricRow` (`:4017`) printed SKU as the Vendor-row title and **never** `f.vendor`.
- `stripWorkroomVendorFromFabricsWithoutProduct` (`:3219`) cleared `f.vendor` when it matched the workroom name and there was no Product Library pick. Vendor rows have no `productId`, so `renderForm()` (`:11097`) wiped Bartolo / matching names on every COM→Vendor click.
- `renderForm` wiped `#formPane` (`:11102`) with no `scrollTop` restore. Role Label called `renderForm()` on every keystroke (`:11899`).

## Root cause

Vendor-supplied material UI omitted the manufacturer field, preview omitted `f.vendor`, and the COM-only stripper ran on Vendor rows after the form rebuild.

## Change

- Manufacturer / vendor name field on Vendor-source rows (keeps `fab.vendor`).
- Preview Vendor rows show manufacturer, then Part #, then color.
- `stripWorkroomVendorFromFabricsWithoutProduct` skips Vendor-supplied rows.
- Restore `#formPane` scroll after rebuild; Role Label updates heading in place (no full form rebuild).

## Self-test

- Grep: Vendor branch has `Manufacturer / vendor name`; strip function has `fabricIsWorkroomMaterial` early return.
- File tail intact (`</html>` at :12193).

## Verify (after staging)

1. Ctrl+Shift+R on `https://cch-platform-staging.web.app/builder/`
2. Header build tag **2026-09-02wo169-vendor-keep**
3. GRE-W-05 Material A: enter manufacturer, click **Vendor** — name still in the field and on the preview (right column)
4. Scroll stays in Materials (does not jump to Project)
