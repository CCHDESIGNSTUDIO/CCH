# WO-314 DONE — Client chat button stays on screen

Cindy Oct 19. Staging Holtz Hill overview. No Client Chat button.

## Cause

The button was appended after Pepper in the header cluster. The page clips anything past the right edge, so Pepper stayed visible and Client Chat did not.

## Change

`platform/cch-portal-records.js` `placeChatInHost` / `dockChatButton`. The button is inserted as the first control in that cluster, to the left of Pepper. It is placed again after the header finishes loading.

Cache `cch-portal-records.js?v=20261019wo314`. Studio 9.9.398.

## Self-test

`node --check` exit 0. Staging hosting 2026-10-19 ~16:05.

## Verify

Hard refresh staging Holtz Hill overview. CLIENT CHAT is in the top bar, to the left of Pepper, in white on navy.
