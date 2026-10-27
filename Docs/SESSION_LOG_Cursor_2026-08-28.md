# Session Log — Cursor: Due now + partial invoice

**File:** SESSION_LOG_Cursor_2026-08-28.md
**Original Author:** Cursor (CR)
**Created:** August 28, 2026
**Last Modified:** August 29, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.6

**Workspace:** `CCH-Platform-Deploy`
**Primary paths:** `platform/cch-square-pay.js`, `platform/index.html`, `platform/client.html`, `platform/cch-proposals-invoices-fix.js`, `Functions/squarePaymentLink.js`
**Firebase:** production hosting **9.9.293** (Cindy GO 2026-08-29 ~09:25 as #1). Staging same working copy.

**Cursor transcript:** [Due now Square wording](279644c6-5000-49b8-a153-1dfc50b1ee12)

## Revision history

- v1.6 (Aug 29, 2026, CR): Cindy GO — production hosting **9.9.293** (~09:25). No git commit.
- v1.5 (Aug 28, 2026, CR): Proposal stays open while lines are Pending (Partially Invoiced, Show Pending/All on Edit). Studio **9.9.293**.
- v1.4 (Aug 28, 2026, CR): Inspiration board ▲/▼ reorder + star glyph `?` → ★ (`\u2605`). Studio **9.9.292**, staging queued.
- v1.3 (Aug 28, 2026, CR): Invoice email copy — Square = credit card only; Zelle text only. RH tax audit: do not rewrite Ron-printed invoices.
- v1.2 (Aug 28, 2026, CR): Production Firestore rename — 5 Walker Zanger Costa Mesa / Mattise pins → **Matise 3/4 2 CM** on RH Slabs board. North Hills unchanged.
- v1.1 (Aug 28, 2026, CR): Partial invoice unlock shipped production. Due now hosting shipped. Cindy #1 GO.
- v1.0 (Aug 28, 2026, CR): Cindy tested INV-6011 on staging; rail said “of remaining” instead of leftover after payment.

---

## Session overview

Cindy set INV-6011 Due now to 50% on staging; copy treated pre-payment balance as “remaining.” Then she GO’d production as #1. She then asked to invoice approved proposal lines without waiting for every item to be decided. Convert already copied approved-only; the gate required all lines decided + `clientApprovedTotalAt`. Gate unlocked.

---

## What changed

| File | What |
|------|------|
| `platform/cch-square-pay.js` | Due now: This payment + Balance after this payment. |
| `platform/index.html` | Gate `proposalInvoiceGateSummary` (~10038): ≥1 approved line; pending allowed. Client/staff approve + Convert UI. **9.9.287**. |
| `platform/client.html` | Same client approve / banner. `?v=20260828partialinv1`. |
| `platform/cch-proposals-invoices-fix.js` | Convert override no longer blocks on pending / total stamp. |

`node --check` on `cch-square-pay.js` and `cch-proposals-invoices-fix.js` — pass.

---

## What was NOT done

- Not committed / not pushed.
- `squarePaymentWebhook` production not confirmed this turn (`checkSquarePayment` started after hosting).
- INV-6063 not resent / not re-pushed to QB.

---

## Firestore / production

Script: `_scripts/rename-wz-costa-mesa-to-matise_BY_CURSOR_2026-08-28.js --apply`  
Board: `boards/cloud-rolling-hills/ideabooks/5zLV53Y6IBMkPGDgKHaM` (Slabs). Marker `wz-email-2026-08-27`.

Five pins renamed to **Matise 3/4 2 CM** (indexes 10–14). Did not touch North Hills captions. No hosting deploy required for the names to show.

---

## Open / next session

1. Cindy: https://cch-platform.web.app Ctrl+Shift+R — sidebar **v9.9.287**. Proposal → Convert to Invoice with some lines still pending.
2. Finish `checkSquarePayment` + `squarePaymentWebhook` on production if still pending.
3. INV-6065 Due now: set 50%, Refresh Square pay link, open invoice after he pays.

---

## Verify commands

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
node --check platform\cch-proposals-invoices-fix.js
```

Production: https://cch-platform.web.app — hard refresh — Convert to Invoice on a proposal with approved + pending lines.

---

## No git commit

Not committed. Shared working copy.
