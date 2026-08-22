# WO-057 DONE CR — Trade-cost push: match lines by title+vendor · Jul 24, 2026

**Build:** v9.8.109 (`wo057-tradecost-line-title-vendor-2026-07-24`)  
**Script cache:** `cch-cost-lock.js?v=20260724cost13`  
**Where:** staging (queue) — prod on Cindy GO  
**Files:** `platform/cch-cost-lock.js`, `platform/index.html` (cache + build tag only)

## Grounding (this session)

| Symbol | file:line |
|--------|-----------|
| `cchScanClipsByTitleVendor` | cch-cost-lock.js ~209 |
| `cchScanLinesByTitleVendor` (new) | ~247 |
| `cchFallbackScanProjectsForLibraryId` / `lineHasLibraryId` | ~530 / ~520 |
| `cchDocLineCostLockReason` (draft proposals unlocked) | ~42 |
| `cchApplyTradeCostTarget` heal | ~700+ |
| `cchPruneStaleLibraryUsageRefs` (new) | ~310 |

## What changed

1. **Deep-scan lines by title+vendor** when `libraryProductId` is missing (mirrors clips). Different libId → skip.
2. **Locks unchanged** — draft proposals stay eligible; sent/locked invoices & POs still skipped.
3. **Heal on apply** — stamp `libraryProductId` on title+vendor matches (line + clip).
4. **Prune stale `libraryUsageRefs`** when doc missing / line gone / load throws — on modal open and on Apply.

## Self-test

- `node --check platform/cch-cost-lock.js` — OK
- Grep: `cchScanLinesByTitleVendor`, `staleRefKeys`, `20260724cost13`

## Verify (Claude, staging)

Cafe Milk Crackle (or any library product) on a **draft** proposal line **without** `libraryProductId` + a Selection clip at a different cost → push → both under WILL UPDATE → Apply → both get new DNET and line/clip gain `libraryProductId`. Stale "Could not load linked doc" refs cleared after one push/open.

**State:** DONE-UNVERIFIED  
**Prod:** wait for Cindy GO (not bundled with WO-058).
