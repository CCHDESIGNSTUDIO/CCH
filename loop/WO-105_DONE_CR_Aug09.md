# WO-105 DONE (MVP) — Staff Pepper agenda · CR Aug 09

## Grounding
- `currentEmail()` / `currentMemberName()` — who’s asking
- `buildUnbilledTimeDigest` previously grouped by `member` but dumped whole project — now scopes to signed-in by default
- Firm agenda: `loadMyUnbilledSummary` via `timeEntries.member` + invoice/proposal studio caches + OM PO confirm for Vanessa lane

## Change (`cch-pepper.js` `20260809wo105`, Studio **9.9.125**)
1. **Morning brief** — once per calendar day (localStorage `cchPepperAgendaDay`): auto-open staff Pepper, “Hi Cindy/Vanessa…”, money-first spoken line
2. **Preset** “What’s on my agenda” + free-text match (`what's on my agenda` / `my plate` / …)
3. **Scope** — login email → person; unbilled filtered to fingerprints; All Team only if asked
4. Never on `#/clientview`

## Honest limits (not full WO-106 yet)
- Proposal/invoice “to send” / AR counts need `_cachedInvoices` / `_cachedProposals` (open Financials once) or falls back to firm `financialSummary` with an honest note
- Client-activity money cues + Timely missing-day names = follow-on
- Drafts-on-tap for each bucket = follow-on

## Verify (staging)
1. Hard refresh Studio (orange STAGING) signed in as Cindy or Vanessa
2. Pepper panel opens with Hi {you} + open items (once/day; clear `localStorage.cchPepperAgendaDay` to retest)
3. Preset **What’s on my agenda** anytime
4. Client portal must NOT show staff Pepper
