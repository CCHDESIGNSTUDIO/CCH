# Session Log — Cursor: WO-104 Client Pepper open-items

**File:** SESSION_LOG_Cursor_2026-08-09.md  
**Original Author:** Cursor (CR)  
**Created:** August 9, 2026  
**Last Modified:** August 9, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Primary paths:** `platform/cch-client-pepper.js`, `platform/client.html`, `platform/index.html`  
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Session overview

Cindy said **build it** for **WO-104** — Client Pepper greets with live open items (decisions / proposals awaiting client / open invoices). Accuracy locked: counts must match portal badges; never invent; zero → omit.

## What changed (not deployed)

| File | Change |
|------|--------|
| `platform/cch-client-pepper.js` | Build `20260809cp104` — snapshot greeting, wait badge, chips, nudges, what’s-new once |
| `platform/client.html` | `cpPortalBuildPepperOpenSnapshot` + mount wire + script `?v=20260809cp104` |
| `platform/index.html` | Same snapshot/mount; `CCH_BUILD` **9.9.121** |
| `loop/WO-104_DONE_CR_Aug09.md` | Done note |
| `loop/LOOP_LEDGER.md` | WO-104 → DONE-UNVERIFIED |
| `_DEPLOY_QUEUE.md` | Staging pending line |

## Needs GO / deploy

- **Staging:** done — 9.9.121 → 9.9.124 (auto-open iterations)
- **Production:** done 2026-08-09 ~23:20 — Cindy GO for **client** Pepper WO-104 only (9.9.124 / cp104d)
- **Staff Pepper WO-105** MVP: **PROD** 9.9.125 (Cindy GO ~23:28) — morning auto-open + agenda preset

## Verify (after staging deploy)

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

Hard refresh `https://cch-platform-staging.web.app/#/clientview/{project}` — Pepper spoken/badge counts = Decisions + Proposals (awaiting) + Open Invoices badges.
