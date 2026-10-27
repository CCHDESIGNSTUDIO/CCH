# WO-255 DONE — Client portal Pepper stays on Elise

Cindy Sep 28: Pepper on the client portal spoke as the normal boring man.

## Grounding

- Client voice is Elise via `cchPepperSpeak` (`platform/cch-client-pepper.js` `speakPepper` / `speakPepperElise`).
- On any Elise failure the old code called `speakPepperBrowserFallback`, a `SpeechSynthesisUtterance` with no voice chosen. That is the computer’s default male voice.
- `Functions/cchPepperSpeak.js` `assertCanSpeak` rejects a client line longer than 320 characters. `buildGreetingText` can exceed that once a proposal nudge and “new this week” are added, so Elise threw and the male voice played.

## Change

- `platform/cch-client-pepper.js`: spoken line clipped to 300 characters. Male browser fallback removed. If `audio.play()` is blocked (`NotAllowedError`), the same Elise clip plays on the next click.
- Cache buster `cch-client-pepper.js?v=20260928elise` in `platform/client.html` and `platform/index.html`.
- `CCH_BUILD` 9.9.366 `pepper-elise`.

## Not changed

- Staff Pepper (`cch-pepper.js`).
- The written greeting text on screen (only the spoken line is shortened).
- Cloud Function. Client clip keeps the existing 320-character gate from rejecting the call.

## Self-test

- `node --check platform/cch-client-pepper.js` passed.
- Not deployed. Production after Cindy GO. Hard refresh. Button should say Hear Pepper. Greeting should be Elise.
