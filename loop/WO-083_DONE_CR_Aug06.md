# WO-083 DONE — Receiver/vendor ADDRESS street-only (stop re-append) · #1 Cursor · Aug 06

**State:** DONE-UNVERIFIED · **Verifier:** Fable · **Staging:** queued/deploying with this note

## Root cause (grounded this session)

`saveVendor` / vendor edits write camelCase `addressLine1` + composed `address` (`cch-functions.js` ~1051–1056).

`cchAddressPartsFromRecord` (`index.html` ~36810) only looked for `AddressLine1` / `Address` / `address` — **never `addressLine1`**. Prefill therefore always took the composed `address` (street + city/state/zip), so edits to ADDRESS did not stick.

`cchCoerceStructuredAddressParts` early-returned when city/state/zip existed **without** stripping duplicates from line1 (`~36872` before fix).

## Files touched

| File | Change |
|------|--------|
| `platform/index.html` ~36810–36987 | Read `addressLine1`/`addressLine2`; add `cchStripDuplicateCityStateZipFromStreet`; coerce strips exact trailing duplicates when parts exist; export helper |
| `platform/index.html` ~33708 | `_shipToContactEntry` prefers compose-from-parts over raw `rec.address` |
| `platform/index.html` ~66390 | `saveVendorEdit` exact-duplicate strip on save |
| `platform/index.html` CCH_BUILD | `9.9.92` / `wo083-address-line1-street-only-2026-08-06` |
| `platform/index.html` script tag | `cch-functions.js?v=20260806wo083` |
| `platform/cch-functions.js` `saveVendor` | Strip exact duplicate on save before compose/persist |
| `platform/cch-functions.js` receivers list | Address column composes from parts |

## Self-test

- `node --check platform/cch-functions.js` — OK
- Logic: with `addressLine1: "610 S. Grand Ave # 103"` + city/state/zip set, prefill ADDRESS = street only; `address` remains multiline compose for legacy readers; ship-to body still full address via `_shipToBodyFromRecord`

## Fable verify (staging)

1. Delivery/Receivers → Designers Moving Service (or equivalent): ADDRESS street-only after delete city/state/zip + save + reopen.
2. Same on a Vendor and Workroom (shared modal).
3. PO ship-to / print still shows full address with separators (no `103Santa Ana`).
4. No console errors. Hard refresh Ctrl+Shift+R; build tag `9.9.92`.

## Guardrails respected

No bulk migration. Exact-duplicate strip only. Shared Vendor/Workroom/Delivery modal. No pricing. No prod until Cindy GO.
