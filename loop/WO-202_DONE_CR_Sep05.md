# WO-202 DONE — Preview toolbar: BOLD NOTE on Chrome PDF hint

**Change ID:** 9.9.323  
**Date:** 2026-09-05  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging queue)

Cindy Sep 5 staging INV-6014 Print/PDF bar: the gold Chrome-headers hint sat under the doc number and read as document copy.

## Diagnosis (file:line)

- `platform/cch-proposals-invoices-fix.js` `poPrintHint` ~5643–5647, painted in `.print-hint-screen` ~5853.
- CSS ~5671: 10px, weight 400, gold — same family as toolbar title, no label.
- `@media print` ~5812 already `display:none` on `.print-hint-screen`. This is **screen chrome only**, not the print layer.

## Surfaces

| Intended | Must not |
|----------|----------|
| Preview toolbar hint (proposal + invoice long copy; PO shorter copy) | Print/PDF body, Bill To / Ship To, line items |
| Hidden on print (unchanged) | Portal (`_portalOpen` still suppresses the hint) |

Pre-existing: proposal Preview uses the same long copy that says “your invoice.” Not changed this pass.

## Change

- Prefix both hints with `<strong class="print-hint-label">NOTE</strong>`.
- Label: 700, 0.12em letter-spacing, gold `#C4A464`. Body of the hint slightly paler so NOTE reads as the instruction, not the document.
- `CCH_BUILD` **9.9.323**. Cache buster `cch-proposals-invoices-fix.js?v=20260905hint1` in `index.html` + `client.html`.

## Self-test

- `node --check platform\cch-proposals-invoices-fix.js`
- File tail intact (`})();`).

## Verify after staging

Hard refresh. Sidebar **9.9.323**. Open INV-6014 Print/PDF: **NOTE** bold gold, then the Chrome headers copy. Same on one proposal Preview and one PO Preview. Print itself must not show the hint.
