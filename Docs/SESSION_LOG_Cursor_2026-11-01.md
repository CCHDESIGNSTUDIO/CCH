# Session Log — Cursor: Rolling Hills variance links

**File:** SESSION_LOG_Cursor_2026-11-01.md
**Created:** Nov 1, 2026
**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app

## Session overview

Cindy asked why the purchase-order variance rebuild was still waiting. WO-402 wrote the invoice links on production. No hosting deploy. Studio stays 9.9.479.

## What changed

- INV-6063: eight variance lines now point at the current bill-charge id. Amounts unchanged.
- Cleared three stale bill-item marks: PO-9027 $1,476 off INV-6079, PO-9060 $0.70 off INV-6086, PO-12915 $178.22 off INV-6079.
- PO line prices were not rewritten. Variance amounts already matched the live bills.

## Not deployed

No code change. Nothing waiting on a production GO. Temp script deleted.

## Open

- PO-9029 freight: invoice $130 vs bill $127.10. Not linked.
- PO totals that changed after send, flagged and not rewritten: PO-9063, PO-9057, PO-9030, PO-9059, PO-9028, PO-9060, PO-9046, PO-9062, PO-9058, PO-9047.
- One QuickBooks bill per vendor invoice was not built.

## Verify

Hard refresh. Open the variance list for Cloud Rolling Hills. PO-9030 freight should show INV-6063. PO-9027 $1,476 should not show INV-6079. PO-9060 $49.75 should show INV-6086 and the $0.70 row should not.
