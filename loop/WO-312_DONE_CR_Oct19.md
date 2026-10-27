# WO-312 DONE — Chat panel says Client chat

Cindy Oct 19. Staging Holtz Hill project chat worked. The panel title said Project chat. She wants Client Chat.

## Change

`platform/cch-portal-records.js` `openChatPanel` ~616. Panel heading text is `Client chat`. The existing uppercase style shows it as CLIENT CHAT. Same panel on the studio project page and the client portal.

`platform/index.html` and `platform/client.html` — script cache `cch-portal-records.js?v=20261019wo312`. Studio 9.9.396, tag `client-chat-title`.

## Self-test

`node --check platform/cch-portal-records.js` exit 0.

## Verify

Hard refresh staging. Open the project chat. The box title reads CLIENT CHAT.
