# WO-227 DONE — Payout 2022 layout + pay rules

**Change ID:** 9.9.347  
**Date:** 2026-09-15  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy asked for the new payout layout (Cowork WO-DRAFT v1.1 BF-DRAFT-B). Layout requires pay rules (BF-DRAFT-A remainder) or Employee Cost / margin are fiction.

## Grounding

Replaced `renderPayrollReport` + `exportPayrollXLSX` in `platform/index.html` (payout block ~53003–53466). Helpers: `_payoutAnnotate`, `_payoutPayKind`, `_payoutIsCchInternal` (exact name/id, not `startsWith('cch')`), tracked/added/billed hours.

## What the screen does now

- Amount due = **tracked hours × $65** on payable rows only.
- Named deductions: CCH internal, T&E, non-billable, added (+HRS), Personal/PTO held out of due.
- CCH toggle, default **off**.
- Two blocks: **Not paid** then **Paid**, with Rate / Tracked / Added / Duration / Total Billable / Total Cost / Employee Cost / Margin $ / Margin %.
- Unpaid rows: Employee Cost **$0.00**. Margin % blank when Total Cost is 0.
- By project table. Export is a real **.xlsx** (SheetJS already on the page) with Payout + By Project sheets; paid Employee Cost cells formula `L* $B$2`.
- Eden **billable** rows are payable (Cindy invoiced INV-6076 and already paid those hours). Eden 0.50h admin stays unpaid. No Eden-wide withhold.

## Not touched

`timeEntries` documents. Invoice math. Leakage tiles. Smart Time summaries.

## Verify after staging

Hard refresh. Sidebar **9.9.347**. Financials → Subcontractor Payout → Vanessa → **2026-08-16 to 2026-08-31**.

Expect: Amount due **47.25h / $3,071.25** (the old $2,502.50 plus Eden’s 8.75 tracked billable). CCH 15.75h, T&E 0.75h, PTO 1.00h, Eden admin 0.50h, Katke 0.25 added named as deductions. CCH toggle ON raises due by 15.75h × $65. Export XLSX opens with two sheets.
