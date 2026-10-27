# Session Log — Cursor: Proposal nickel round, contractor decision email

**File:** SESSION_LOG_Cursor_2026-09-24.md
**Created:** Sep 24, 2026
**Last Modified By:** Cursor (CR)

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app

## Session overview

PRO-3024 markups and room totals were diagnosed. Client unit rounding was changed to the next $0.05 (WO-249). Decision email was changed so a shared contractor gets their own draft (WO-250). Neither is deployed. `platform/index.html` also holds other uncommitted work, so this session did not deploy hosting.

## What changed (not deployed)

| WO | Build | What | Queue |
|----|-------|------|-------|
| 249 | 9.9.362 | Product client price rounds up to the next $0.05 | staging pending |
| 250 | 9.9.363 | Decision email opens a second draft to each active contractor, on their contractor link | staging pending |
| 251 | 9.9.364 | Edit line items table fits the window (proposal, invoice, PO) | staging pending |

Local `CCH_BUILD` is **9.9.364** `doc-edit-fit`. Production hosting before these was **9.9.361**.

## Needs GO

Staging deploy of `platform/index.html` ships WO-249 and WO-250 together, and also whatever else is uncommitted in that file. Do not deploy this dirty tree as a WO-250-only ship. Production only on Cindy’s typed GO.

## Not done

- Markup-mismatch warning before proposal save. Not started.
- Proposal pencil kicking back to the edit page and slow cell save. Diagnosed, not changed.
- Room-header totals still sum stored `amount`. Not changed.
- No Firestore price rewrite on PRO-3024.
- No commit.
