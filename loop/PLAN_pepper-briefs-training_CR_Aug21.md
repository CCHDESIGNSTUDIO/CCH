# Pepper briefs + training — plan (not a deploy order)

**CR_Aug21** · For Cindy. Executable WOs: **WO-119**, **WO-120**.  
Law: `STOP-READ-FIRST.md` — staging first; **no AI deploys production**; Cindy runs `DEPLOY-PRODUCTION-DANGER.bat` after she has tested staging.

## What this is not

It is **not** “add the nine-line facts block.” That is already in `Functions/cchPepper.js` `buildSystemPrompt()` ~91–102 (shipped 2026-08-12; Pay Now line corrected in tree). `Docs/WO-PEPPER-FACTS_CR_Aug12_v1.0.md` is a superseded stub. Ignore it.

## Two workstreams

| WO | Job | Files | When |
|----|-----|-------|------|
| **119** | **Training** — brief cadence in the system prompt + Daily / Weekly / Monthly presets | `cchPepper.js`, `cch-pepper.js` | First. Small. Staging functions + hosting. |
| **120** | **Briefs** — person-scoped weekly + monthly *content*; morning daily already live (WO-105) | `cch-pepper.js`, maybe `index.html` only if a Reports-page button is approved | After 119. Evening timeline stays **WO-111** (not duplicated). |

Copy-clip WO from Aug 12 is unrelated and already staging-first. Leave it alone.

## Cadence map (product)

- **Daily morning** — already WO-105 / “What’s on my agenda” (PROD 9.9.125).
- **Daily evening** — WO-111 Day in Review (filed, not in ledger table). Until that ships, evening = leftover plate, not a fake timeline.
- **Weekly** — Pepper “here’s your week” (Monday framing). Existing `#/reports` Weekly Reports page stays; do not replace it.
- **Monthly** — new Pepper period, same buckets. No auto-write to `reports` without a typed GO.

## Existing code this plan reuses (leads, not evidence — Cursor re-greps)

- Facts + voice: `Functions/cchPepper.js` ~44–103
- Agenda: `platform/cch-pepper.js` `PRESETS` ~1248, `my_agenda`
- Firm weekly numbers UI: `platform/index.html` `renderReportsPage` ~83517, `generateReportNow` ~83609
- All-seeing cache: WO-106 — **not** in this plan

## Deploy (every executor)

1. Edit. Queue `_DEPLOY_QUEUE.md` **staging**.
2. `#1` deploys staging. Cindy tests.
3. Production: Cindy only, gated bat, after staging. Never Cursor, never a chat “GO”, never a bare `firebase deploy`.

## Open for Cindy (not blocking 119)

1. Drop the Aug 12 C-Team weekly-report markdown into `Docs/` if Pepper’s weekly should match that spec exactly (it is not in the repo today).
2. Type GO on WO-120 Phase C only if you want Day in Review built *inside* 120 instead of WO-111.
3. Monthly: this month vs last complete month — WO-120 picks one and documents it unless you specify.
