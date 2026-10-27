# WO-211 DONE — PO line editor Save crashes (missing Retail field)

**Change ID:** 9.9.332  
**Date:** 2026-09-08  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED

Cindy Sep 8 PO-9054 **Edit Line Item** Save (Walker Zanger Calacatta slab): console `Uncaught TypeError: Cannot read properties of null (reading 'value') at saveDocLineItem ((index):37278:68)`. Tried ~10 times. Photo never stuck.

## Diagnosis (file:line)

- `saveDocLineItem` `platform/index.html`:37278 (pre-fix): `document.getElementById('piRetail').value` with no null check.
- PO modal `_piPricingGrid` `:36710` is Qty / Cost / Shipping only — **no `piRetail`**, no `piMarkup`.
- Save threw before any Firestore write. Airtable `airtablePoReceiver` 500 in the same console is a separate Cloud Function error and was not the Save crash.

## Surfaces

| Intended | Must not |
|----------|----------|
| PO Edit Line Item **Save** (and Upload / replace image) | Add Retail/Markup columns to PO Edit table |
| | Per-line Vendor column on PO Edit |
| | Write back to library/clips |
| | Print restyle |

## Change

- `_piFieldVal` — missing inputs keep the previous line value.
- `saveDocLineItem` uses it for qty/cost/markup/shipping/retail/title/desc/shipTo.
- PO modal **Upload / replace image** writes Firestore immediately (`docEditSave`), does not wait on Save.

Studio **9.9.332** `po-line-save-piretail-2026-09-08`.

## Self-test

- Grep: no unguarded `getElementById('piRetail').value`.
- File tail: `</html>` intact.

## Verify

Hard refresh. Sidebar **9.9.332**. PO-9054 Edit → click the thumb → Upload / replace image → Save. Preview shows the new photo. No console TypeError on Save.
