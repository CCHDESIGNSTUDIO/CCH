# WO-016 DONE · Remove PO profit tile · Cursor · Jul 11, 2026

**Change ID:** pending #1 assign (BF) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | `renderAllPOs` — removed 4th "Against Profit" tile; `renderPOsTab` — removed "Product Profit" tile + `_poProductProfit` calc |

## Behavior

1. Firm-wide Purchase Orders: three tiles only (Total PO Cost, Paid to vendors, Bill balance due).
2. Project PO tab: three tiles only (Total PO Cost, Paid/Received, Outstanding).
3. Financials Product Profitability + FFE Product Profit left intact (separate admin analytics).

## Verify (Claude, staging)

- `#/allpos` — no Against Profit tile; Vanessa session same.
- Rolling Hills → PO tab — no Product Profit tile.
- Console clean.

## Deploy

Staging hosting only.
