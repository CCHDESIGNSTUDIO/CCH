# WO-027 · Purchase Orders summary strip: the three tiles don't reconcile — make Ordered = Paid + Open Balance · CW Jul 12
**Change ID:** pending #1 assign (PO) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Display-only math fix in `index.html` `renderAllPOs()`. No schema change, no data write. **Staging only.**

## What Cindy said (Jul 12)
"The total PO, paid and balance don't add up. It's probably double adding for the bills maybe?"
On the firm-wide Purchase Orders page the three summary tiles read (her screenshot):
Total PO Cost **$374,198.04** · Paid to vendors **$177,495.79** · Bill balance due **$27,068.05**.
177,495.79 + 27,068.05 = 204,563.84, which is **$169,634.20 short** of the $374,198.04 total.

## Root cause (grounded — `index.html` `renderAllPOs`, `cch-po-bill-variance.js`)
It is **not** double-counting. It is the opposite: the third tile **under-counts**. The three tiles
measure different populations and different bases, so they were never an equation.
- **Tile 1 "Total PO Cost"** `totalAll` @index.html:63304 = Σ `cchPoListPoTotal(p)` over **all** filtered POs =
  the PO *document* total (what we ordered). Helper @cch-po-bill-variance.js:1217.
- **Tile 2 "Paid to vendors"** `totalPaidAll` @:63307 = Σ `cchPoListPaidForRow(p)` over **all** POs = actual
  vendor payments (`cchPoVendorBillPaidAmount`, uses `Math.max` vs the Houzz fallback @:1202-1209, so no
  double-add). Helper @:1273.
- **Tile 3 "Bill balance due"** `totalBillDue` @:63317-63321 = Σ `cchPoAmountDue(p)` **but only when
  `p.bill && p.bill.received`** (line 63319). So every PO that's been ordered but has **no vendor bill
  entered yet** is excluded entirely. That ordered-but-unbilled bucket (~$169,634) is in neither Paid nor
  Bill-balance-due — it's invisible.
Net: Tile1 = what we ordered; Tile2 = what we paid; Tile3 = unpaid remainder on billed POs **only**. Paid +
Bill-due can never equal Total unless every PO has a received bill equal to its PO total. The three are each
individually correct for their own label but they're presented side-by-side as if they sum, which misleads.

## The correct identity (per PO)
PO document total = Paid + Open balance (± variance where the vendor bill differs from the PO at send).
There is already a helper that computes open balance correctly for **both** billed and unbilled POs:
`cchPoListBalanceForRow` @cch-po-bill-variance.js:1279-1290 —
  • bill received → `cchPoAmountDue` (billTotal − billPaid, ≥0)
  • not received but paid>0 → poTotal − paid
  • not received, unpaid → poTotal
Σ `cchPoListBalanceForRow` over all POs ≈ Total − Paid ≈ **$196,702.25** for Cindy's snapshot.

## Change (display only, `renderAllPOs`)
1. **Tile 3** relabel **"Open balance"** and compute over **all** filtered POs:
   ```
   const totalOpenBalance = filtered.reduce(function(s, p) {
     return s + (typeof window.cchPoListBalanceForRow === 'function' ? window.cchPoListBalanceForRow(p) : 0);
   }, 0);
   ```
   Show `$${totalOpenBalance...}`. Now Tile1 ≈ Tile2 + Tile3 and the row reads as a sum.
2. Keep the existing **bill-balance-due** and **received-bill count** as the tile's small sub-caption so the
   billed-only figure isn't lost: e.g. `${billsReceivedCount} PO(s) billed · $${totalBillDue...} bill due ·
   variance net ${...}$${totalVariance...}`. Colour gold when totalOpenBalance>0 else green.
3. Do **not** touch Tile1/Tile2 math. Do not change any helper. `cchPoAmountDue`/`totalBillDue`/`totalVariance`
   stay computed (used in the sub-caption).
4. Coordinate with **WO-016**: WO-016 removes the 4th "Against Profit" tile (@:63352-63356). After both, the
   strip is exactly three tiles: **Total PO Cost · Paid to vendors · Open balance**, and they reconcile.

## Acceptance (binary)
1. On the firm-wide Purchase Orders page, Total PO Cost − Paid to vendors = Open balance (to the penny, allowing
   the net-variance delta shown in the sub-caption).
2. The billed-only "bill due" figure and received-bill count still appear as the tile sub-caption (nothing lost).
3. Period toggle / project / vendor / status filters all recompute the three tiles consistently (same `filtered`
   set drives all three).
4. No console errors; no change to any row cell or helper; WO-016's tile removal still applies.

## Verify (Claude, staging)
Open #/allpos → confirm Tile1 − Tile2 = Tile3. Apply a project filter and a period toggle → confirm the identity
still holds on the filtered subset. Screenshot to loop/verify/WO-027/.

## DONE note
loop/WO-027_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
