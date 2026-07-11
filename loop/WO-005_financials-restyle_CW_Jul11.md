# WO-005 · Project Financials page — kill the gray, restore white boxes + accent lines · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Cindy's words (Jul 11, looking at staging /#/project/7225-bugletrail Financials)
"Not great — get rid of the gray and go back to our small accent lines and white boxes."

## Change
The Revenue Snapshot / Consultant Costs / Purchase Orders & Expenses cards render as GRAY-filled panels with colored numbers. Restyle every stat card on the project Financials tab to the platform's standard pattern — the Financial Health strip on project Overview is the reference implementation:
white background, 1px light border, thin colored accent line across the top edge, 10-11px uppercase letter-spaced label, large mono number, small muted subline. No gray fills anywhere (gray is reserved for disabled/ghost states).
Keep all values, calcs, and admin gating exactly as-is — this is CSS/markup only.

## Acceptance
1. Zero gray-filled content cards on the Financials tab.
2. Cards visually match the Overview Financial Health strip (side-by-side screenshot comparison).
3. No value or label data changes; no console errors.
