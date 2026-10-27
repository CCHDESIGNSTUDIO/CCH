# WO-220 DONE — Receive bill: editable qty + conf # as invoice #

**Change ID:** 9.9.341  
**Date:** 2026-09-10  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 10 PO-9053 Receive vendor bill: Qty greyed out on Price change / credit; four Basalt Black boxes checked showed “Select one PO item to calculate.” Also asked for a check to use confirmation # as vendor invoice #.

## Diagnosis (file:line)

- Qty was `readonly` on purpose: `cchPoPriceChangeBlockHtml` (`cch-po-bill-variance.js` ~1947).
- Calc required exactly one Charge-applies-to line: `cchPoCalcPriceChangeAmount` used `poLineIds.length !== 1` (~1910). Four identical $971.44 lines could not calculate.
- Checking a second line unchecked the others (`cchPoViPoLineChanged` exclusivity). Initial HTML could still show all four checked, then refresh cleared Qty.
- Vendor invoice # (`cchBillVendorInvNum`, header ~2455) was separate from `cchPoOrderConfNumber` (~4989). No copy checkbox.

## Change

- Qty is editable. Amount = (invoice unit − PO unit) × **typed qty**.
- Multiple Charge-applies-to lines allowed when they share the same PO unit (qty sums, then you can edit).
- Checkbox **Use confirmation # … as vendor invoice #** when the PO has a confirmation #. Empty invoice # prefills from confirmation.

Surfaces: Receive vendor bill (and matching vig charge rows). Not print/PDF.

## Files touched

- `platform/cch-po-bill-variance.js` — `cchPoPriceChangeSelectedLines`, `cchPoCalcPriceChangeAmount` ~1887–1931; `cchPoPriceChangeBlockHtml` ~1934; `cchPoRefreshPriceChangeRow` ~1991; `cchPoViPoLineChanged`; header + `cchPoBillToggleConfAsInv` ~2426–2478; `cchPoOpenReceiveBillModal` ~6032; collect rows pass qty.
- `platform/index.html` — `CCH_BUILD` 9.9.341; `cch-po-bill-variance.js?v=20260910po220`

## Verify

Hard refresh staging. Cloud Rolling Hills → **PO-9053** → Receive vendor bill → Type **Price change / credit**.

1. Check all four Basalt Black (same $971.44). Qty should fill (sum). Type a qty (e.g. 2). Invoice unit 908.52 → amount = (908.52 − 971.44) × qty.
2. If the PO has a confirmation #, Vendor invoice # should fill and the confirmation checkbox should be checked.

Print/PDF unchanged — not this WO.
