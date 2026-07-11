# WO-004 DONE — Cursor 1 · Jul 11, 2026

**Executor:** Cursor 1 · **Build:** `20260711sp1`

## Files touched

| File | Change |
|------|--------|
| `platform/cch-project-subpanel.js` | **NEW** — feature-flagged project sub-panel (panel #2 only) |
| `platform/cch-client-activity.js` | Expose `_cchCaGetBadgeCounts()` for Decisions/Comms badges |
| `platform/index.html` | Script tags: `cch-project-subpanel.js?v=20260711sp1`, bump client-activity to sb2 |
| `Docs/NAV_SPEC_FOR_CURSOR.png` | Annotated spec image (panels 1/2/3) |
| `loop/WO-004_project-subpanel-nav_CW_Jul11.md` | PNG reference added |
| `loop/LOOP_LEDGER.md` | WO-004 → IN PROGRESS |

## Self-test (local logic review)

1. Flag OFF (`localStorage` unset): `spTeardown()` — no `#cchProjSubPanel`, `.project-tabs` visible.
2. Flag ON: `cchSetNavPanel(true)` or `?nav=panel` — white 216px panel, tab bar hidden, `.main.cch-nav-panel-on` margin shift.
3. Grouping matches WO-004: Overview/Follow-Ups(ghost)/Tasks pinned; Design/Client/Money/Operations groups.
4. Financials omitted when not in `ADMIN_EMAILS`.
5. All routable items call `switchProjectTab` with existing keys; Decisions → `#/clientview/{id}/decisions`; Client Portal → `#/clientview/{id}`.
6. Console: `[CCH Project Sub-Panel] build 20260711sp1`.

## Flag toggle (staging verify)

```javascript
cchSetNavPanel(true)   // enable sub-panel on project pages
cchSetNavPanel(false)  // revert to tab bar
```
