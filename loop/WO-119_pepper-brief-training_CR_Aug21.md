# WO-119 — Pepper training: brief cadence (not the facts block)

**CR_Aug21** · Lane: **Cursor** · File lane: `Functions/cchPepper.js` + `platform/cch-pepper.js` only  
**Depends on:** facts already in `buildSystemPrompt()` — **do not re-insert them.**  
**Sibling:** WO-120 (daily / weekly / monthly brief *product*). This WO is *how she talks*.

## Already shipped — do not redo

| What | Where | Status |
|------|--------|--------|
| CCH Studio facts block (docs, snapshots, partial approval, POs-after-paid, QB + Square/Zelle, client boundary, Timely=prod) | `Functions/cchPepper.js` `buildSystemPrompt()` ~91–102 | Staging + prod **2026-08-12**; Pay Now line corrected in tree (`cchPepper.js:98`) |
| Personality / voice / standing incident | same function ~49–89 | Live |
| “What’s on my agenda” + morning person-scope | WO-105 · `platform/cch-pepper.js` `my_agenda` | **PROD 9.9.125** |

`Docs/WO-PEPPER-FACTS_CR_Aug12_v1.0.md` is a **SUPERSEDED stub**. Ignore it. Facts WO v1.1 is documentation only.

## Goal

Teach Pepper the **shape** of a daily / weekly / monthly staff brief so she does not dump a novel, invent numbers, or contradict the facts block. Add three presets that call those shapes. **No new Firestore collections. No personality rewrite.**

## Change (minimal)

### 1. `Functions/cchPepper.js` — `buildSystemPrompt()` and `PRESET_FRAMES`

Add a **BRIEF CADENCE** section **after** the facts block (do not touch facts bullets). Something like:

- Daily = today’s plate for the signed-in person: money first, then chase, then one next step. Short.
- Weekly = last 7 days + what’s on the plate for the coming week. Monday framing: “here’s your week.” Same money loop. Short sections, bullets.
- Monthly = calendar month. Same buckets, not a dump of every line.
- Always person-scoped unless they ask All Team.
- Numbers only from the digest. If a bucket is missing, say so. Never guess.
- Draft-only. Never claim you emailed, invoiced, or pushed to QB.

Add `PRESET_FRAMES`:

- `daily_brief`
- `weekly_brief`
- `monthly_brief`

Each frame must tell the model to use MY AGENDA / FIRM-WIDE STAFF DIGEST and stay scoped.

Do **not** paste the Aug 12 facts array again. Do **not** restore “no Pay Now in Studio.”

### 2. `platform/cch-pepper.js` — `PRESETS` (~1248)

Add three buttons after “What’s on my agenda”:

- Daily brief
- Weekly brief
- Monthly brief

Wire them like `my_agenda`: pull `buildMyAgendaBrief` (and existing firm digest), then call `cchPepper` with the matching `action`. Re-grep `PRESETS` / `p.key === 'my_agenda'` before editing; do not invent a second agenda builder.

## Constraints

- Staff-only. Never on `#/clientview`.
- Surgical. No `index.html` split. No new libraries.
- Ground before edit (`CODE_GROUNDING_PROTOCOL`).
- **Staging first.** Queue hosting + `functions:cchPepper` via `_DEPLOY_QUEUE.md`.
- **You may not deploy production.** Cindy deploys prod after she tests staging, through `DEPLOY-PRODUCTION-DANGER.bat` (typed `I HAVE TESTED ON STAGING` + `CH`). A chat GO is not that gate. Never a bare `firebase deploy`.

## Deploy (staging only)

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

```powershell
firebase deploy --only functions:cchPepper --project staging
```

Hosting: bump cache buster on `cch-pepper.js` per `cch-platform-js-edits.mdc`, then queue **staging** hosting. Do not run production hosting.

## Verify (staging Pepper, signed in as Cindy, then Vanessa)

1. “How does a client pay?” → Square link and/or Zelle; no card form; QB is SoT for paid. (Facts still intact.)
2. Daily brief → person-named, money-first, short, no invented $.
3. Weekly brief → last-7 / coming-week shape, not a daily dump.
4. Monthly brief → month shape; if digest has no month rollup, she says so instead of guessing.
5. Tone still Pepper. Draft-only.

## Acceptance

1. Facts block still a single copy; Pay Now line still Square/Zelle.
2. Three presets exist and hit the new frames.
3. Staging verified. Prod only on Cindy’s gated script.

## Rollback

Revert the two files; redeploy `cchPepper` to staging.
