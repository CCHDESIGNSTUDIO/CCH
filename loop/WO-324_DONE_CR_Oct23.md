# WO-324 DONE — Speak a client chat message

Cindy Oct 23. Speak button on a chat message. Staging.

## Files

- `platform/cch-portal-records.js` — `renderChat` adds Speak. `speakChatMessage` reads the text with the browser voice.
- `platform/index.html`, `platform/client.html` — Studio 9.9.410, tag `chat-speak`. Cache `cch-portal-records.js?v=20261023wo324`.

## What changed

A message that has text gets a Speak button. Click it to hear that text. Click Stop to silence it. A photo with no text has no button. This uses the browser voice, not Pepper’s Elise voice.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Not clicked in the browser.

## Deploy

Staging hosting 2026-10-23. Production not deployed. Functions not deployed. No commit.
