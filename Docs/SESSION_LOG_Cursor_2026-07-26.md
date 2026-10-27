# Session Log — Cursor: Pepper Fable pack (D+B+A+E) → v9.9.3

**File:** SESSION_LOG_Cursor_2026-07-26.md  
**Created:** July 26, 2026  
**Author:** Cursor  

## Overview

Built Fable v1.1 Pepper pack through **D + B + A + E** (not F / not C). Staging queue pending for hosting + `functions:cchPepper`.

## What changed

| Build | Change |
|-------|--------|
| (earlier) | Pepper `cchPepper` + clear-on-project-change **v9.9.2** |
| **v9.9.0** | Panel/Tabs race fix (sp10) |
| **v9.9.4 / 20260726d** | Pepper **missing on staging**: init ran before Firebase auth → never mounted. Now waits on `onAuthStateChanged` (+ poll). Button offset left of Fix-It FAB (`right:88px`). Confirmed: Pepper never saves bills. |
| **v9.9.3 / 20260726c** | Pepper digests: open `clientDecisions`, Follow-Ups (`_cchFuPepperDigest` fu8), richer activity, unbilled time |
| | Presets: Unbilled time, Vendor status follow-up, Report a bug |
| | **A:** OM Missing ETA + open-PO tables **Follow up**; PO page next to Send to vendor → `cchPepperVendorFollowUp` → mailto To vendor / Cc orders@ |
| | **E:** `window.cchFbQuickSubmit` + Pepper report_bug path |
| | CF presets: `unbilled_time`, `vendor_status_followup`; digest wording |

**Not built (per Fable):** C (Pepper writes bills), F (vendor bill PDF pre-fill).

## Later same day (voice + route context)

| Build | Change |
|-------|--------|
| v9.9.5–13 | OM firm-wide digest; mic restart; Speak unlock; voice picker; female-only; Smart Time digest; G.1 personality |
| **v9.9.14 / 20260726p** | Open PO page: hash `#/project/…/po/{id}` → `OPEN PO PAGE` digest (vendor, lines, ETAs); Pepper header `PO-#### · project`; CF: never ask which PO / don’t send to OM |
| **v9.9.15 / 20260726q** | Pepper Speak → ElevenLabs: `cchPepperSpeak` + secret `ELEVENLABS_API_KEY`; picker Elise + 2 more; free browser voices as fallback; Speak still default off |
| **v9.9.16** | Full Executive personality profile (proactive “Already done / Taken care of”); Speak `voice_settings` slightly faster; never invent completed work |
| **v9.9.17** | Elise / Jessa / Vanessa labels; ElevenLabs Speak on prod |
| **v9.9.18** | Firm-wide Follow-Ups + Tasks digests |
| **v9.9.19 / 20260726t** | Ask before Speak: long/list/number-heavy replies stay text + **Read aloud** / Skip; short offer only (“Want me to read it?”). CF: prefer short bullet lists |

## Deploy

- **Staging:** firm digests ~17:30 PT (v9.9.18); **ask-before-Speak queued** (`_DEPLOY_QUEUE.md` pending v9.9.19)  
- **Production:** ~v9.9.17 (voices + personality); firm digests + ask-before-Speak need GO  
- **Git:** not committed — shared dirty tree

## Verify (staging PO context)

1. Ctrl+Shift+R → sidebar **v9.9.14 · 2026-07-26**
2. Open PO-9002 (or any PO) → Pepper header shows **PO-9002 · project** (not only project slug)
3. Ask “create an email to follow up on the status of this order” → draft for that PO’s vendor/lines; **no** “which order?”
4. Clear chat if an old confused thread is still open, then re-ask

## Open (Cindy)

- F: upload on PO vs Pepper vs both; blank-if-uncertain  
- Production GO for Pepper voice + PO-page context (if wanted)  
- Confirm rates OK in unbilled summary (staff-only; Fable default yes)
