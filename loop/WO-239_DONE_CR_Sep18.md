# WO-239 DONE — Add-item rail shows trade cost, not client sell

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-18  
**Change ID:** 9.9.354

## Symptom

Cindy on production INV-6067 Manage → Add item: Project Selections prices were client sell (Sq. Lantern Med **$5,712** = Sell/ea). Invoice COST is **$4,760**. She called it Product Library showing client cost.

## Grounding

- Screenshot is the **Add item** rail (`openDocItemsSidebar` / `filterDocSidebar`), not `#/library`.
- Main Product Library list/grid already uses `_libTradeCostNum` and labels **Trade cost** (`index.html:67911`, `67988`). That page was not the bug.
- Rail cards `renderItemCardPS` (~44922) and `renderItemCard` (~45100) displayed `sellPrice || clientPrice`.
- Aug 2 2026 commit `8f67bf9` (Studio **9.9.78**): `price = sell > 0 ? sell : cost` → `price = sell > 0 ? sell : 0` with comment “Display sell only — never fall back to junk unit cost.” That is when the picker stopped showing trade cost.
- `addSidebarProductToDoc` (~45247) still copies **cost** onto the line and computes sell from markup. Display-only bug; adding a line does not write client sell into the library.

## Change

`platform/index.html`:

1. `_disRailDisplayTradeCost` — trade cost (`costPrice` / `unitCost` / `cost`); blank if under $1 (same junk floor).
2. Both picker cards use it. No sell/clientPrice on the rail.
3. `CCH_BUILD` **9.9.354**.

## Surfaces

- **Intended:** Add item rail on proposal / invoice / PO / Selections (Project Selections + Products tabs).
- **Must not:** invoice COST / MARKUP / SELL/EA math; Product Library page; paid invoices; print.

## Verify

INV-6067 Add item → Project Selections: Sq. Lantern Med shows **$4,760** (cost), not $5,712. Products tab same. Clicking Add still creates the line with cost + markup as before.
