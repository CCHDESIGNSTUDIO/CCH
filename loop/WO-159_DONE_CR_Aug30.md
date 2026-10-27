# WO-159 DONE — PO Print: tag once, title 11px, no page stretch

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-08-30  
**Build:** Studio **9.9.302** `cch-proposals-invoices-fix.js?v=20260830poprint3`

## Symptom (Cindy)

Staging PO-9013 Print / PDF: **L68** and **Hall Option** still under ITEM (gold DESCRIPTION) while TAG column is **—**; item title too big/bold; dead band between Ship To and the table, and between Total and footer.

## Surfaces

| Surface | This WO |
|---------|---------|
| PO Print / PDF popup | **Yes** (`body.cch-po-vendor-print`) |
| Invoice print | No |
| Proposal print | No |
| Tear sheets | No |

## Grounding (this turn)

- `cchPoLineSpecsBlockHtml` `platform/index.html:9606` — `omitTag` skipped the Tag *label* but `includeDescription` still dumped the raw description (`L68` / Width / Height / Depth).
- `_premiumRoomTagTd` `cch-proposals-invoices-fix.js:5064` — TAG cell used **`cchLineTagExplicit` only** (stored `lineTag`). L68 lived in description, so the column stayed —.
- Item title: `'<strong>'` + CSS `td strong { font-size:13px }` and PO override 12px/600 (`:5787` before this WO).
- Page stretch: `.page { min-height:calc(100vh - 44px) }` + `.page-body { flex:1 }` + `.doc-footer { margin-top:auto }` (`:5652–5653`, `:5771`).
- Ship To name: 16px/700 from WO-157 (`:5516`).

## What changed

1. **`cchPoSplitPrintDescription`** — pulls fixture code (`L68`) and Width/Height/Depth lines out of description. TAG column uses that. ITEM keeps leftover only (**Hall Option** as 11px text, no gold DESCRIPTION header). Dimensions go to the specs row.
2. **PO item title** class `cch-po-item-title` — 11px / 500 / navy. Invoice/proposal titles unchanged.
3. **PO page** — no 100vh stretch; footer sits after totals. Tighter Ship To → table padding.
4. **Ship To / Bill To name** on PO print — 13px / 600 (was 16/700). Address still 13px navy stacked. Not applied to invoice/proposal Bill To.

## Files (line ranges)

- `platform/index.html` — helper `:9566–9602`; specs `:9606–9665`; `CCH_BUILD` `:4340`; cache buster `:89314`
- `platform/client.html` — same helper + specs `:3834–3920`; cache buster `:12380`
- `platform/cch-proposals-invoices-fix.js` — `_premiumRoomTagTd` `:5064–5080`; title `:5316`; Ship To `:5516`; CSS `:5691`, `:5776–5821`

## Self-test

- `node --check platform/cch-proposals-invoices-fix.js` — pass
- File tail intact (`})();` at end)

## Verify after staging deploy

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — orange STAGING — sidebar **v9.9.302**
2. PO-9013 → Print / PDF (do not use production; prod is still 9.9.299)
3. TAG = **L68**; ITEM has title + Hall Option + Dimensions spec; no second L68; no gold DESCRIPTION block
4. Title not huge/blue-bold
5. Footer under Total, not at the bottom of a stretched page
6. Spot-check one invoice Print, one proposal Print, one tear sheet — unchanged

**No production GO** (print-surface lock).
