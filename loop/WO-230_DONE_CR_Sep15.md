# WO-230 DONE — Houzz pending vs QB YTD 2026 + 2025 Bills PDFs (read-only)

**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (audit, no hosting)

Cindy: match Houzz pending to the QB bills report in the folder; then added YTD Bills and 2025.

## Sources

- Studio pending: `_debug/HOUZZ_OPEN_POS_VS_STUDIO_QB_FIELDS_BY_CURSOR_2026-09-15.csv` (WO-229, 82 clip rows)
- YTD: `Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments 9.15.26.pdf` (Jan 1–Sep 15 2026, 5 pp, 39 bills)
- 2025: `Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments_2025.pdf` (Jan–Dec 2025, 13 pp, 120 bills)
- Join: Studio `PO-400123` ↔ QB `BL-400123HZ`

## Matcher

`_scripts/wo230-match-houzz-qb-ytd-2025-READONLY_BY_CURSOR_2026-09-15.py`  
Line-parse with wrapped `BL-\n400030HZ` stitch and same-line `4,600.00 2,300.00` amounts.

Outputs:

- `_debug/HOUZZ_PENDING_VS_QB_YTD_AND_2025_BY_CURSOR_2026-09-15.csv`
- `_debug/HOUZZ_PENDING_VS_QB_YTD_AND_2025_BY_CURSOR_2026-09-15.json`
- `_debug/QB_OPEN_BILLS_YTD2026_AND_2025_BY_CURSOR.csv`

## Findings (no writes)

Of 82 Houzz pending: **47** matched in QB with open $0, **3** matched with leftover cents/dollars (Studio remaining $0), **32** not in either PDF.

Of 20 Studio still-due ($12,139.65):

- **4 / $4,932.33 — QB already paid (open 0):** Fabricut PO-400085 $2,686.73 (`BL-400085HZ`), OC Custom PO-400106 $1,054 (`BL-400106HZ`), Currey PO-400113 $917.63 (`BL-400113HZ`), Arteriors PO-400123 $273.97 (`BL-400123HZ`).
- **16 / $7,207.32 — not in either PDF.** Largest: JT Designs PO-400023 $2,071.50 (not the same as 2025 `BL-12872` $805).

QB still open:

- YTD: John Pomp `BL-9015` $2,300 (Holtz, not Houzz pending); Extreme Decor `BL-400045HZ` $380 (not on Studio pending).
- 2025 leftover not restated on YTD: $1,384.11 (JT Designs BL-12872 $805, BL-12781 $300, Sole Shades BL-12888 $213.64, plus smalls; Visual Comfort BL-400041HZ $10 / Regina Andrews $1 / Made Goods $0.75 against Studio $0 rows).

## Not done

No PO status writes. Close the 62 zeros and the 4 QB-paid Studio balances only on Cindy GO.
