# WO-028 Phase B DONE · Bi-Weekly Update Studio entry points · Cursor · Jul 12, 2026

**Change ID:** WO-028 Phase B · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/cch-progress-updates.js` | `cpPuPreviewUpdate`, editor save refreshes Studio project view; build `20260712pu5` |
| `platform/index.html` | Comms tab → `progressUpdates` feed + studio toolbar; `renderUpdatesTab` uses `cpPuLoadUpdates`/`cpPuRenderList`; legacy `showNewUpdateModal`/`editUpdate`/`previewUpdate` redirect to Phase B editor; overview **+ Bi-Weekly Update** quick button |
| `platform/client.html` | Cache buster `pu5` |

## Behavior

1. Studio Communications tab: **+ Bi-Weekly Update** opens full editor; feed rows load from `progressUpdates` with Preview/Edit/Publish.
2. Project overview sidebar: **+ Bi-Weekly Update** quick action.
3. `renderUpdatesTab` (legacy route) renders client-portal-style list + studio toolbar.
4. Publish writes `progressUpdates` + `whatsNew` on publish (unchanged from pu4).

## Verify (Claude, staging)

- Open project → Communications → create/edit bi-weekly update with image upload + text.
- Preview modal matches client portal layout.
- Client portal `#/clientview/{id}/updates` still renders published updates.

## Deploy

Staging hosting (`cch-studio-staging`).
