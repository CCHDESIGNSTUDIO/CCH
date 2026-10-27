# WO-228 DONE — Payout screen + XLSX match Figma

**Change ID:** 9.9.348  
**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy: export was unreadable (narrow columns, truncated headers, pay-rate formula on B2 while Tracked sat in L). Figma mockups are the layout target.

## Grounding

`exportPayrollXLSX` was `platform/index.html` ~53394–53463 (WO-227). No `!cols`, headers wrapped into neighboring cells. Formula `L*$B$2` assumed a column map the sheet did not present.

Pay math in `_payoutAnnotate` / `_payoutIsPayable` **unchanged**. Eden billable stays payable.

## What changed

**Screen (`renderPayrollReport`):** four navy KPIs, four white metrics, Summary with named deductions, hour log grouped by project / service (billed first, then not billed).

**Export:** columns A–K = 2022 (Designer → Total Employee Cost), L–O Tracked / Added / Margin $ / %. Header freeze. Column widths. Currency / hours / % formats. Not-billed then billed with subtotals + grand total. Pay rate in one G cell; Amount due `hours*rate`; paid Employee Cost `Tracked*$rate`. Sheets: period tab, By Project, Added Hours, Flags.

Community SheetJS 0.18.5 does not write navy cell fills (no style plugin). Layout and formulas are the gift; fills are not claimed.

## Verify after staging

Hard refresh. Sidebar **9.9.348**. Subcontractor Payout → Export XLSX. Headers fully readable. Change the Pay rate cell; Amount due and paid Employee Cost recalculate.
