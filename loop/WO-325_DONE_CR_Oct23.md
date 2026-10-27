# WO-325 DONE — Chat mic and Pepper's voice

Cindy Oct 23. The Speak button used a male browser voice. She wanted a microphone on the message, and Pepper's voice.

## Files

- `platform/cch-portal-records.js` — Mic fills the message box. Speak calls `cchPepperSpeak` with Elise. Browser speech is cancelled, not used to read the message.
- `platform/index.html`, `platform/client.html` — Studio 9.9.411, tag `chat-mic-elise`. Cache `cch-portal-records.js?v=20261023wo325`.

## What changed

Mic sits next to Photo. Tap it, speak, the words land in the message box, then Send. Speak on a message uses Elise, the same voice as portal Pepper. Stop silences it. A photo with no text still has no Speak button.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Not clicked in the browser.

## Deploy

Staging hosting 2026-10-23. Functions not deployed. Production not deployed. No commit.
