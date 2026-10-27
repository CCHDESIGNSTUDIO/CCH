# WO-242 DONE — PO At Workroom: pick list / Ship To

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-19  
**Studio:** 9.9.357 `po-workroom-pick`

## Symptom

Cindy on West Avalon PO: modal **PO location** / “Enter workroom name:” — she typed OC Custom Furniture. Ship To and Vendors → Workrooms already exist.

## Grounding

- Prompt: `cchPoSaveFulfillmentStatus` `cch-po-bill-variance.js` ~1369 (`cchPrompt('Enter ' + label + ' name:', …, 'PO location')`).
- Same type-in: `cchPoQuickSetShippingStatus` ~933, `cchPoSaveShippingStatusFromSelect` ~894, `updatePOLocationPrompt` `index.html` ~75386.
- Loc field was a free-text input: `cchPoFulfillmentStatusEditorHtml` ~1123.
- Workroom from Ship To only if the string matched `/workroom|fabricat|drapery…/` (`cchPoResolveReceivingLocation` ~1660) — **OC Custom Furniture** never matched.

## Change

1. Resolve workroom from Ship To vs Workrooms list (same matcher as receivers), then first Ship To label if it is not client/job site.
2. Loc control is a **select** (Workrooms or Receivers), not a text box.
3. Type-in `cchPrompt` replaced with: use Ship To if known, else a list picker.

Surfaces: PO shipping status only. Invoice payments / print / Edit PO Ship To dropdown unchanged.

## Self-test

- `node --check platform\cch-po-bill-variance.js` — pass
- Tails intact (`})();` / `</html>`)

## Verify (staging)

1. Hard refresh. Open the West Avalon PO.
2. Set **At workroom**. If Ship To is OC Custom Furniture, it should take that — no type-in.
3. If Ship To is empty, a **Workroom** dropdown from Vendors → Workrooms.
