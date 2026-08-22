# WO-096 · Studio window title for Timely Memories · CW Aug 7

**Status:** DONE (local) — staging queue  
**Verifier:** Cursor · Aug 7, 2026

## Problem

Timely Memories labels Chrome time by **browser tab title**. Studio hard-reset `document.title` to `CCH Design Studio` on every `navigate()`, so all web time collapsed into one undifferentiated bucket — no project or page context for auto-tagging.

## Root cause (grounded)

| Location | Behavior |
|----------|----------|
| `platform/index.html:14` | Static `<title>CCH Design Studio</title>` |
| `platform/index.html:navigate()` | `document.title = 'CCH Design Studio'` on every route change |
| `platform/cch-followups.js` | Same reset on Follow-Ups route |

No other `document.title` assignments in live platform JS.

## Fix

- **`cchUpdateStudioWindowTitle(crumbs)`** — builds `CCH Studio · {Project} · {Section}` from breadcrumbs + `#/project/{id}/{tab}` hash
- Hooked at end of **`setBreadcrumb()`** (every page render already calls this)
- Removed title reset from **`navigate()`** and **`cch-followups.js`**
- Project tab labels match UI (e.g. `ideabooks` → **Inspiration**, `time` → **Time**)
- Fallback: `CCH Studio` when no project/section

## Examples

| Route | Tab title |
|-------|-----------|
| `#/projects` | `CCH Studio · Projects` |
| `#/project/rolling-hills/ideabooks` | `CCH Studio · Rolling Hills · Inspiration` |
| `#/project/holtz-hill/time` | `CCH Studio · Holtz Hill · Time` |
| `#/timetracker` | `CCH Studio · Smart Time` |

## Timely alignment

Functions layer maps Timely project names via `normTimelyProjectName` / `resolveCchBoardIdFromBoardsArray`. Consistent `{ProjectName}` in the tab title helps Timely auto-tagging line up with CCH board names.

## Verify (after staging deploy)

1. Hard refresh production or staging Studio
2. Open a project → switch tabs (Overview, Inspiration, Time) — **browser tab title** changes each time
3. Work 2–3 min on two different projects; check Timely Memories timeline — should show project + section, not flat "CCH Design Studio"
4. Global pages (Smart Time, Product Library) show section name without project

## Files

- `platform/index.html` — `cchUpdateStudioWindowTitle`, `setBreadcrumb` hook, remove navigate reset, build **9.9.109**
- `platform/cch-followups.js` — remove navigate title reset

## Deploy

Staging hosting + **staging functions** (`timelyAuth`, `timelySyncEntries`). Queue: `_DEPLOY_QUEUE.md`.

## Staging Timely sync (Aug 7)

**Not needed — production only.** Cindy confirmed staging has no Timely logs. Smart Time on staging may show empty `timelyEntries`; **Sync from Timely** is hidden/gated on staging (`cchTimelyEnabledHere()`). Use **cch-platform.web.app** for real Timely sync.
