# WO-101 — Pepper Desktop: installable shell (PWA), step 1

**CW_Aug07** · Lane: **Cursor** · Step 1 of `PEPPER_DESKTOP_BUILD_BRIEF_CW_Aug07_v1.0`. Deliberately the smallest first brick — shell only, no voice loop yet, no computer control ever in this track.

## Goal
Give the existing Pepper her own window on the Windows desktop: an **installable page** that opens standalone (own icon, own window, no browser chrome) and runs the Pepper brain you already have. Nothing new about her intelligence; this is just her front door.

## Scope
1. **Dedicated Pepper page** (e.g. `platform/pepper.html` or a `#/pepper` route) that loads the existing `platform/cch-pepper.js` in a **full-window layout** instead of the corner panel. Reuse the same `cchPepper` cloud function and digests.
2. **Web app manifest** (name "Pepper", `display: standalone`, `start_url` = the Pepper page, Pepper avatar as the icon, navy theme color) so Edge/Chrome "Install app" places a desktop icon that opens Pepper in its own window. Register the manifest + a minimal service worker so install is offered.
3. **Guards unchanged:** staff-only (same server-side email boundary as today); must NOT render on any `#/clientview/*` route; read + draft only, same guardrails (never sends/saves/pushes, never claims completion).

## Out of scope (later steps, own WOs)
- Voice loop (push-to-talk in + ElevenLabs speak-back) → WO-102.
- Desktop persona pass: touch-friendly layout, quick buttons (Status · Ready to bill · Draft a follow-up), persistent chat → WO-103.
- Native tray shell / wake word / any computer control → separate, later, carefully-gated. Not this track.

## Acceptance
1. In Edge/Chrome, "Install" offers **Pepper**; installing gives a desktop icon that opens Pepper in its **own standalone window**.
2. In that window, Pepper works exactly as the in-panel version (answers, drafts, digests) via the existing brain.
3. Staff-only; never appears on client routes; no rates/hours exposure.
4. Verified on staging, then prod on Cindy's GO.

## Note
Reuses `ANTHROPIC_API_KEY`, `elevenlabs-pat.env`, `cchPepper.js`, `cchPepperSpeak.js`, `cch-pepper.js` — all already in the repo. No new secret, no new model, no new billing relationship.
