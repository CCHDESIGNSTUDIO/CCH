# WO-222 DONE — INV-6064 + PO-9047 Kitchen/Powder Matisse 1 1/4 → 3/4

**Change ID:** data (production Firestore)  
**Date:** 2026-09-11  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED

Cindy Sep 11: Kitchen and Powder Matisse should be **3/4"**, same cost and total. MBR stays 1 1/4.

## Applied (production)

| Doc | Lines | Before | After | Money |
|-----|-------|--------|-------|-------|
| INV-6064 `Kw4Dbyi6kdsyVCnSYGhb` | Kitchen #2, Powder 1 #13 | 1 1/4 · SKU `2SLAPIC3CMP` | **3/4 Slab Calacatta Matisse Polished** · SKU `0034MASMCNCPORGCAMAT` | qty 1, cost 4443, mk 20, amount **5335** |
| PO-9047 `pSmTNxtFhi00ZcHeGRUk` | Kitchen #1, Powder 1 #5 | same 1 1/4 | same 3/4 identity | qty 1, cost **4443**, amount **4443** |

Invoice total left **62447.11**. PO total left **34640.5**. MBR Matisse not touched.

Image/library from `products/3_4_slab_calacatta_matisse_polished__walker_zanger__stone___tile__finish_polished`. Kitchen dims `110" x 61"` kept.

Backup: `_backup/wo222-matisse-34-2026-09-11-21-09-38/`  
Script: `_scripts/wo222-inv6064-po-matisse-34_BY_CURSOR_2026-09-11.js`

## Verify

Hard refresh INV-6064 Manage: Kitchen + Powder 1 titles **3/4**, Sell/ea / Total unchanged. PO-9047 same two rooms. MBR still **1 1/4**.
