# WO-010 DONE · Follow-Ups module · Cursor 1 · Jul 11, 2026

**Change ID:** pending #1 assign (FT) · **State:** DONE-UNVERIFIED · **Executor:** Cursor 1 · **Verifier:** Claude (Cowork)

## Delivered

| File | Build | What |
|------|-------|------|
| `platform/cch-followups.js` | `20260711fu1` | Self-contained Follow-Ups command center — cross-project + per-project |
| `platform/cch-project-subpanel.js` | `20260711sp3` | Un-ghosted Follow-Ups entry; badge from `_cchFuGetBadgeCounts` |
| `platform/index.html` | — | Script tags only (`cch-followups.js`, bumped `sp3`) |

## Behavior

1. **Main rail** — `Follow-Ups` nav item (injected by module) → `#/followups` scans all active projects.
2. **Project sub-panel** — `Follow-Ups` tab routes to `#/project/{id}/followups`; same two-lane board scoped to one project.
3. **Detectors 1–13** implemented per `loop/WO-010_followups-module_CW_Jul11.md` (proposals, decisions, invoices, portal stale, tasks, approved-not-invoiced, paid-no-PO, answered decisions, design boards, room selections, inspiration not shared, hours without What's New, meta no-time stall).
4. **UI** — white stat cards + accent top lines; age chips a1/a2/a3; gold primary actions; `⋯` menu (snooze/hold/nav/copy); out-of-order pipeline actions marked disabled in menu.
5. **Vanessa gate** — amounts on rows; no admin-only leakage stat framing for non-`ADMIN_EMAILS`.
6. **Feature flag** — `localStorage['cchFollowups']` default **ON**; set `0` to disable.
7. **Snooze/hold** — `localStorage['cchFollowupsSnooze']` only (no Firestore writes).

## Verify (Claude, staging)

- `#/followups` — two lanes, cross-project project prefix on rows, nav badge count.
- `#/project/holtz-hill/followups` + `#/project/cloud-rolling-hills/followups` — scoped board, sub-panel entry active (panel flag on).
- Non-admin session — amounts visible, no leakage stat card.
- Click primary actions — pipeline-legal navigation (proposal/invoice/PO/time/comms).
- Console — `[CCH Follow-Ups] build 20260711fu1`, zero errors.

## Rollback

`localStorage['cchFollowups']='0'` or remove script tag. Sub-panel re-ghost manually if needed.

## Deploy

Standard staging handoff appended to `_DEPLOY_QUEUE.md`.
