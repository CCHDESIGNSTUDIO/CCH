# Session Log — Cursor: WO-226 category + WO-227 payout layout

**File:** SESSION_LOG_Cursor_2026-09-15.md  
**Original Author:** Cursor (CR)  
**Created:** September 15, 2026  
**Last Modified:** September 15, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.5  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Session overview

Cindy: Time Ledger Billable vs contractor payout Non-Billable on Eden. Vanessa already paid on correct billables. INV-6076 Sent. Then: new payout layout.

## What changed

### WO-226 — Studio 9.9.346 — PRODUCTION (Cindy GO ~09:15)

Payout Hour Log + CSV classify each entry. Removed last-row-wins `byProject.category`. Pay math not changed.

### WO-227 — Studio 9.9.347 — staging live 2026-09-15 ~12:55 (not production)

2022-style payout: Amount due, named deductions, CCH toggle default off, Not paid then Paid tables, By project, margin, SheetJS xlsx. Pay on trackedHrs. Eden billable payable.

### WO-228 — Studio 9.9.348 — PRODUCTION (Cindy GO ~13:22)

Figma layout: KPI cards, grouped hour log, XLSX with column widths + 2022 A–K + live pay-rate formula. Pay rules unchanged.

## Verify on production (9.9.348)

Hard refresh https://cch-platform.web.app — no staging banner. Sidebar **9.9.348**. Subcontractor Payout → Vanessa → 2026-08-16 to 2026-08-31. Export XLSX.

### WO-230 — Houzz pending vs QB YTD 2026 + 2025 (read-only, no hosting)

Cindy dropped `BillsandAppliedPayments 9.15.26.pdf` and `BillsandAppliedPayments_2025.pdf`. Matcher joined `PO-400nnn` to `BL-400nnnHZ`. 4 Studio-due Houzz rows already paid in QB ($4,932.33). 16 still-due rows not in either PDF ($7,207.32). YTD still open: John Pomp BL-9015 $2,300 + Extreme Decor BL-400045HZ $380. No PO status writes.

### WO-232 — Vendor bills Inv date (9.9.350, PRODUCTION ~17:19 Cindy GO)

`#/vendorbills` and OM Vendor bills: **Inv date** = document date; **Received** = receivedDate then receivedAt.

### WO-231 — Receive bill keep modal (9.9.350 PRODUCTION hosting ~17:19; pushBillToQB ~17:21)

PO-9042: bill never saved; QB PO 75830 exists. Overlay click closed the form. Push fail remounted the page. Modal stays; bill date clamped in functions. Cindy could not reproduce on staging (QB bill push is production-only).

## Open items

- Leakage P1, Smart Time summaries P1
- Leakage P1, Smart Time summaries P1
- INV-6076 2.50h $0 Non-Billable line vs 0.50h in period
- PTO pay rule still held (named as deduction, $0 due)
