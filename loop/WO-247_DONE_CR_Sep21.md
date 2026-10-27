# WO-247 DONE — PO Email vendor in More; never Publish to client dashboard

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-21  
**Studio:** 9.9.360 `po-email-vendor-menu`

## Symptom

Cindy on Cloud Rolling Hills **PO-9060** (Walker Zanger): went to Send PO / email, left for email, came back. Send was gone; top bar showed **Receive bill** only. Could not re-email so orders@ stays on the thread. **Publish to client dashboard** was in PO More — POs are never pushed to the client dashboard.

## Grounding

- `cchPoSendToVendor` `platform/cch-po-bill-variance.js` ~6090 — locks PO then `cchPoEmailVendor`. Canceling mailto does not unlock.
- After send, lifecycle `st === 'sent'` wrap at ~8386 prepends **Receive bill** and drops **Send**.
- Waiting procurement lane ~5329 had **Mark as confirmed** only — no Email.
- `cchBuildDocViewTopbar` PO More `platform/cch-proposals-invoices-fix.js` ~2779 — Print, Timeline, QB, Change fulfillment, **Publish**, Attach, Delete. No Email.
- `cchBuildDocEditTopbar` ~2919 — Publish gated `invoice || po || proposal`.
- `emailVendorPO` `platform/index.html` ~75422 → `cchPoEmailVendor` `cch-po-vendor-comms.js` ~91 — mailto only, does **not** lock.

PO-9060 is already sent (Sent Sep 21, QB 76148). Email is the missing action, not another Send/lock.

## Change

| File | Lines | What |
|------|-------|------|
| `platform/cch-proposals-invoices-fix.js` | ~2782–2807 | PO view More: **Email PO to vendor** first; **Publish to client dashboard** removed |
| `platform/cch-proposals-invoices-fix.js` | ~2901, ~2919 | PO Edit More: **Email PO to vendor**; Publish only invoice + proposal |
| `platform/cch-po-bill-variance.js` | ~8386–8388 | Top bar: **Email vendor** always; **Receive bill** still when sent; **Send** still on draft |
| `platform/cch-po-bill-variance.js` | ~5332–5334 | Waiting lane: **Email vendor** next to Mark as confirmed |
| `platform/index.html` | ~4376 | `CCH_BUILD` **9.9.360** `po-email-vendor-menu` |
| `platform/index.html` | ~90542, ~90546 | Cache `cch-proposals-invoices-fix.js?v=20260921po247`, `cch-po-bill-variance.js?v=20260921po247` |

`emailVendorPO` / `cchPoEmailVendor` does not re-lock. Draft **Send** still locks once.

## Surfaces

| Surface | This WO |
|---------|---------|
| PO Manage / Client view More | Yes — Email; no Publish |
| PO Edit More | Yes — Email; no Publish |
| Invoice / proposal Publish | Unchanged |
| Receive bill / Airtable | Unchanged |
| Print / PDF | Untouched |
| Client portal PO load | Not changed (portal still does not list POs) |

## Self-test

- `node --check` on both JS files — pass.
- Tails close with `})();`.
- Grep: no `togglePublished(...,'purchaseOrders')`. Remaining Publish is invoices/proposals only.

## Verify (staging)

1. Hard refresh PO-9060 (or a staging PO that is already sent).
2. Top bar: **Email vendor** + **Receive bill**. More: **Email PO to vendor** first. No **Publish to client dashboard**.
3. Email vendor → prompt → mailto with CC orders@. PO stays sent/locked.
4. Invoice More still has Publish. Proposal More still has Publish.
