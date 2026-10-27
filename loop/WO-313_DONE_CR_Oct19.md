# WO-313 DONE — Chat button text is visible

Cindy Oct 19. Staging Holtz Hill. The chat control was a navy box. The words were there and painted navy, same as the button.

## Cause

`platform/index.html` ~3285. `.topbar button:not(.btn-primary):not(.btn-dark)` forces button text to navy. The chat button sits in that top bar with a navy background, so the label disappeared.

## Change

`platform/cch-portal-records.js`

- Button class `btn-dark` so that top-bar rule does not apply.
- Label color is set on the words: white on navy, navy on gold when a chat is waiting.
- Idle label is `Client chat`. Waiting label stays `New chat`.

Cache `cch-portal-records.js?v=20261019wo313` in `index.html` and `client.html`. Studio 9.9.397.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Staging hosting 2026-10-19 ~16:00.

## Verify

Hard refresh staging. The button next to Pepper reads CLIENT CHAT in white. A waiting chat turns the button gold and says NEW CHAT.
