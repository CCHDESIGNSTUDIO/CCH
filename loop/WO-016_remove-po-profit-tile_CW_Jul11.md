# WO-016 · Remove the broken/leaky "Profit" tile from ALL Purchase-Order summary strips · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## What Cindy said (Jul 11)
On the project PO tab: "This math doesn't make sense — and we should remove the profit." Then on the
firm-wide Purchase Orders page: "it's everywhere." Remove the profit tile from every PO view.

## Why it's wrong (grounded, verified this session)
A Purchase Order is a **vendor-cost** document — it has no client-sell side. So "profit = client sell −
vendor cost" collapses to just **−(vendor cost)** on any PO aggregation. The firm-wide tile doesn't even try:
it's hardcoded to the negative of Total PO Cost. It's meaningless AND it's owner-only profit leakage (Vanessa
must never see profit) — so it fails on both counts. Kill it on PO views.

## Locations (grounded)
1. **Firm-wide Purchase Orders page** (`renderAllPOs`, index.html **:63352–63356**): the 4th tile
   `Against Profit` → value `-$${totalAll.toLocaleString(...)}` (line 63354), subtitle "Direct cost impact".
   This is the `-$1,220,754.26` = −Total PO Cost Cindy screenshotted. **Remove this tile (the whole
   `<div style="flex:1;…">…Against Profit…</div>` block, 63352–63356).** The strip then has 3 tiles
   (Total PO Cost, Paid to vendors, Bill balance due) — they're `flex:1` so they reflow to fill.
2. **Project PO tab** (`renderPOsTab`, index.html ~:26501–26517): in the CURRENT source this strip already
   has only 3 tiles (Total PO Cost / Paid-Received / Outstanding) — the old profit tile (present in the
   Jul 10 snapshot `_cw_idx_20260710.html:26920` as "Product Profit · Client sell − vendor cost (PO lines)")
   is **already removed**. Cindy still sees it because **staging is serving a stale build.** No code change
   needed here beyond confirming it's gone after redeploy.
3. **Sweep:** grep the whole platform tree for any other PO/procurement summary tile with label
   `Against Profit` / `Product Profit` / subtitle `Direct cost impact` / `vendor cost (PO lines)` and remove
   it from PO-context strips (Order Management, project PO tab, firm-wide). As of this session grep found the
   PO-tile text only in index.html; if a module re-injects one, remove it there too.

## Do NOT touch (separate, flag for Cindy — different feature)
- The **Financials tab "Product Profitability"** section (index.html ~:27917) and the **FFE tab "Product
  Profit"** cell (~:27387) are admin-only analytics that DO have a real sell side (invoice/clip client
  price). They are not the broken PO tile. Leave them as-is. **Flag to Cindy:** if she also wants profit
  hidden there (Vanessa rule / preference), that's a separate quick order — confirm before removing.

## Constraints
- Removal only; no recompute. After removing the firm-wide 4th tile, verify the 3 remaining tiles still
  reconcile (Total PO Cost = Paid to vendors + open balance; Bill balance due is its own number).
- Navy/gold, no gray; never split index.html; `node --check` + tail after edit.

## Acceptance (binary)
1. Firm-wide Purchase Orders page shows NO "Against Profit" / profit tile — three tiles only.
2. Project PO tab shows NO profit tile (Total PO Cost / Paid-Received / Outstanding only) after redeploy.
3. No PO or Order Management view renders a "profit" / "against profit" / "direct cost impact" tile.
4. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
After deploy: firm-wide POs + Rolling Hills project PO tab — screenshot both strips confirming no profit
tile; confirm as a non-admin (Vanessa) session too. loop/verify/WO-016/.

## DONE note
loop/WO-016_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
