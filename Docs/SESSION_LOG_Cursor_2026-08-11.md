# Session Log — Cursor: Invoice Publish/Sent, Hixson, portal, chat ping

**File:** SESSION_LOG_Cursor_2026-08-11.md  
**Original Author:** Cursor (CR) / #1  
**Created:** Aug 11, 2026  
**Last Modified:** Aug 11, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.2  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Build (end of day):** Studio **9.9.147** / staff chat `sc090` / bugs `fb147`  
**Branch:** `staging-fixes-2026-07-08`

---

## Session overview

Invoice Client/Manage + Publish vs Sent, Time Ledger Hixson/Greene grouping, staff chat recipient ping, client portal syntax hotfix, Time Ledger double-create guard. Production GO for several items (Hixson, portal, ping).

## Shipped (production)

| Item | Build | Notes |
|------|-------|--------|
| Publish vs Sent; optional email after Publish | 9.9.141+ | Sent always publishes |
| TL invoice group by board + Hixson overrides Greene | 9.9.142–144 | Vanessa unblocked |
| Staff chat recipient toast + ping | sc090 / 9.9.143+ | Cindy confirmed working |
| Client portal `client.html` SyntaxError | hotfix | Broken `/* LOCK */` in string concat |
| TL no double-create + safe release | 9.9.145 | Lock + Firestore re-check |

## Open / follow-up

- Katke INV-6058 discarded by Cindy (kept INV-6059).
- **9.9.147:** Bugs & Requests paint-first (prod-only deploy) — verify sidebar shows v9.9.147 after Ctrl+Shift+R.
- Other local dirty `platform/*.js` may still be uncommitted; hosting deploys upload full `platform/` from disk.
- Historical invoices wrongly marked Sent by old Publish path not auto-corrected.

## Verify (prod)

1. Hard refresh → **v9.9.145**
2. Client link loads (Holtz / any): `client.html#/clientview/{id}`
3. Staff chat: recipient toast + ping while Studio open
4. Time Ledger Create Invoice: one click → alert → opens invoice; second click won’t duplicate hours
