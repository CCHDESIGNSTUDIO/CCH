# WO-021 Phase A DONE · Client Portal Bi-Weekly Updates · Cursor · Jul 12, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Phase B (admin composer + auto-draft) — NOT in this build.**

## Delivered

| File | What |
|------|------|
| `platform/cch-progress-updates.js` | Build `20260712pu1` — landscape update renderer, list, home teaser, Rolling Hills seed |
| `platform/index.html` | Updates nav + routes `#/clientview/{id}/updates` + detail; portal wiring |
| `platform/client.html` | Regenerated via `_scripts/generate-client-html.js` |
| `firestore.rules` | `boards/{id}/progressUpdates` — clients read `published` only |

## Where to click (staging)

1. Open **CCH Studio staging** → Rolling Hills (`cloud-rolling-hills`) → **Preview client dashboard**
2. First staff preview **seeds** `sample-february-2026` (February, Hi Tracey) if missing
3. Sidebar → **Updates** → open the February row
4. **Home** → “Your Latest Update” teaser links to the same page

Direct URL pattern:
`https://cch-platform-staging.web.app/client.html#/clientview/cloud-rolling-hills/updates/sample-february-2026`

## Verify (Claude / Cindy)

- Landscape page matches mockup sections (hero, in progress, highlight, approvals, palette, completed, coming up, sign-off)
- Programa palette; no POs/rates/margins/dollar amounts in update view
- Drafts not visible to clients (seed is `published` only)
- `node --check platform/cch-progress-updates.js` passes; client.html regenerates clean

## Deploy

**Staging deployed Jul 12, 2026** — `hosting:platform` + `firestore:rules` on `cch-studio-staging`.
**Production:** awaiting Cindy GO.
