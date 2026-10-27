# WO-160 DONE — PO Print: vendor name 12px/500 + gap above items

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-08-30  
**Build:** Studio **9.9.303** `?v=20260830poprint4`

## Symptom (Cindy)

Staging PO-9004 Print: **KRAVET** too big and bold; Bill To / Ship To sit on the ITEM table divider.

## Surfaces

| Surface | This WO |
|---------|---------|
| PO Print / PDF | **Yes** |
| Main PO Client View vendor (18px) | No |
| Invoice / proposal / tear sheet print | No |

## Grounding

- `cchVendorContactBlockHtml` `cch-po-bill-variance.js:1746–1754` — default **16px / 700** inline on a `<div>`, not `<strong>`. WO-159 CSS on `.info-value strong` never hit it.
- Print call `cch-proposals-invoices-fix.js:5575` passed `fontSize: 12px` for address only.
- WO-159 print padding: info `8px 18px 4px`, items `6px 18px` — cramped against the table.

## Change

- Print call: `nameFontSize: '12px'`, `nameFontWeight: '500'`. Helper accepts `nameFontWeight` (default still 700).
- PO print CSS: vendor name 12px/500; info-section padding-bottom **18px**; items-section padding-top **18px**.

## Files

- `platform/cch-po-bill-variance.js` `:1746–1754`
- `platform/cch-proposals-invoices-fix.js` `:5575–5580`, CSS `:5788–5798`, print `:5812–5822`
- `platform/index.html` `CCH_BUILD` 9.9.303; `?v=20260830poprint4`
- `platform/client.html` cache buster

## Self-test

`node --check` both JS files — pass.

## Verify (staging)

PO-9004 Print: KRAVET same size as body, not 16/700; clear gap above ITEM header. Invoice print Bill To unchanged.

**No production GO.**
