# WO-070 DONE — #1 Cursor Aug 03

**Build:** v9.9.87 · **Staging** · **Verifier:** Fable · **Not** WO-063

## Part A — All Tasks Project sort
- `allTasksSortByField` / `allTasksSortArrow` + `window._allTaskSort` (default `status`/`asc`)
- Clickable headers: Project (+ Task/Assignee/Priority/Due/Status)
- Display-only; Pepper cache still snapshot after load

## Part B — Sidebar readability
- Static CSS: 12.5px, `rgba(255,255,255,0.88)`, icons 0.78, sections 10px / gold 95%
- Brand gold **`#C4A464` / `var(--gold)`** — no `#C9A96E`
- Pinterest: red border + icon only; label inherits cream/white
- Style Library: accent border/icon `#C4A464`; label inherits
- `cch-client-activity.js`: inject reduced to staging-banner offset + brand-gold active/section (Fable: full dedupe = separate step)

## Canary
- `sidebar_nav_contrast_4_5` (≥4.5:1)
- `sidebar_pinterest_not_red_text`
- `alltasks_project_sort`

## Prod
Cindy GO after Fable sign-off.
