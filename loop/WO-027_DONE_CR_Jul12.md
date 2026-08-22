# WO-027 DONE · PO summary tiles reconcile (Open balance) · Cursor · Jul 12, 2026

**Change ID:** pending #1 assign (PO) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | `renderAllPOs` — Tile 3 relabeled **Open balance**; sums `cchPoListBalanceForRow` over all filtered POs; bill-due + billed count moved to sub-caption |

## Behavior

1. Firm-wide `#/allpos`: Total PO Cost − Paid to vendors = Open balance (to the penny, modulo variance sub-caption).
2. Sub-caption retains billed PO count, bill balance due, and variance net.
3. Tile 1/2 math unchanged; no helper changes.

## Verify (Claude, staging)

- `#/allpos` — confirm Tile1 − Tile2 = Tile3; toggle period/project/vendor filters and re-check.
- Console clean.

## Deploy

Staging hosting (`cch-studio-staging`).
