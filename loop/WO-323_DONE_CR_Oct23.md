# WO-323 DONE — Client chat sits beside Pepper

Cindy Oct 23. Client chat opened on top of Pepper.

## Files

- `platform/cch-portal-records.js` — `placeClientChatPanel`, `watchPepperBesideChat`, called from `openChatPanel`.
- `platform/index.html`, `platform/client.html` — Studio 9.9.408, tag `chat-beside-pepper`. Cache `cch-portal-records.js?v=20261023wo323`.

## What changed

Attempt 1 watched the staff Pepper panel (`#cch-pepper-panel`). The panel in the screenshot is the portal Pepper (`#cchCpPepperPanel`), Hear Pepper / Talk / Send, which uses the same corner as Client chat (`cch-client-pepper.js` line 94, `cch-portal-records.js` openChatPanel).

Attempt 2 measures that portal panel, and the staff panel if it is open, and places Client chat to the left of whichever one sticks out farthest. Closing Pepper puts the chat back at the right.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Not clicked in the browser.

## Deploy

Staging hosting 2026-10-23. Production not deployed. Functions not deployed. No commit.
