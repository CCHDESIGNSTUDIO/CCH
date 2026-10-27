# DONE — Pepper Feature G (voice) · Cursor Jul 26

**Authority:** `Docs/FABLE_DECISION_pepper-features_CW_Jul26_v1.2.md`  
**Build:** v9.9.6 · `cch-pepper.js?v=20260726f`

## Scope shipped (v1)

| Piece | Behavior |
|-------|----------|
| Mic in | Tap start / tap stop (`SpeechRecognition` / webkit). Transcript fills `#cch-pepper-input`. **No auto-send.** |
| Voice out | Header **Speak off/on**, default off (`sessionStorage` `cchPepperSpeak`). When on, reads Pepper’s on-screen reply via `speechSynthesis`. |
| Guards | Same staff panel / no clientview. No new CF, secret, or vendor. |

## Open decision (resolved for v1)

Tap-to-talk (Fable recommendation). Hold-to-talk not built.

## Not built

ElevenLabs / premium TTS (v2).

## Deploy

Staging hosting done ~12:05. Production pending Cindy GO.
