# WO Contractor Access Phase 1 — DONE (Cursor) Aug14

**Build:** Studio **9.9.177** / `contractor-access-phase1-2026-08-14`  
**Module:** `platform/cch-contractor-access.js?v=20260814ca1`  
**Target:** staging hosting + firestore.rules

## What shipped

1. **Invite / revoke / copy link** — Project topbar **Contractors** button → panel creates `boards/{projectId}/contractorAccess/{token}` with `{ name, email, grants:['files'], revoked, lastSeenAt, … }`. Revoke sets `revoked:true`.
2. **Share flag on Files** — `sharedWithContractors` (default off). Upload checkbox + shelf filter **Shared with Contractors** + kebab Share/Unshare + badge.
3. **Money-free contractorview** — `client.html#/contractorview/{projectId}/{token}` lists only shared files; no proposals/invoices/POs/cost/time.
4. **Rules** — `contractorAccess`: public `get`, staff list/create/delete; public `lastSeenAt`-only update when not revoked. Files remain `read: if true` (client portal still does `.files.get()` — full server-side file gate is a follow-on).

## Files touched

| File | Change |
|------|--------|
| `platform/cch-contractor-access.js` | New module (invite, panel, renderContractorView) |
| `platform/index.html` | Build 9.9.177; redirect regex; Contractors btn; Files UI; upload/link share flag; script tag |
| `platform/client.html` | Route `contractorview`; early script load |
| `firestore.rules` | `contractorAccess` match block |

## Grounding (this session)

- `copyClientLink` @ `index.html:76842`
- `projFileBuildRowHtml` / `renderFilesTab` / `uploadProjectFiles` / `projectFileShelfCategory`
- `cchClientRoute` @ `client.html:12048`
- `firestore.rules` files @241; contractorAccess added after

## Self-test (mechanical)

- `node --check platform/cch-contractor-access.js` — OK
- Not wired to `TEAM_CONFIG.contractors`

## Staging verify

1. Hard refresh staging Studio → build **9.9.177**
2. Open a project → **Contractors** → invite name → copy link
3. Files: share one file (kebab or upload checkbox) → open contractor link in private window → only that file, no $
4. Revoke → link shows inactive
5. Confirm client portal still loads (files list)

## Follow-ons (not Phase 1)

- Shared decisions (status, no price)
- Tighten `files` rules once client portal queries by id / `sharedWithContractors` / publish refs only
- Per-contractor item grants (v2)
