# WO-030 DONE · Release Notes catch-up through v9.8.51 · Cursor · Jul 13, 2026

**Change ID:** pending #1 assign (RN) · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | `getCchFeaturesChangelog()` — prepended v9.8.51, v9.8.50, v9.8.0, v9.7.1, v9.7.0 entries from loop work; removed stale v9.6 "updated through v9.6" line |
| `platform/index.html` | `renderReleaseNotes` roadmap — added Bi-Weekly Editor, CCH Voice in AI, Fix-It Assistant; updated AI Auto-Draft + Batch Time descriptions |

## Behavior

1. `#/releasenotes` Release Log shows Jul 11–12 loop batch newest-first above v9.6.0.
2. Bridge entry v9.8.0 (Jul 10 client portal split) closes the Mar–Jul gap without inventing undocumented changes.
3. Roadmap reflects in-flight WO-028/029/025 work.

## Verify (Claude, staging)

- Open `#/releasenotes` — confirm 5 new release entries, stat counts increased, roadmap cards render.
- Header "Current" reads v9.8.51.

## Deploy

Staging hosting (`cch-studio-staging`).
