# WO-280 DONE — Studio pops up when the client is on the portal

Cindy Oct 5. She works in the project, not the client portal. She wants the notice as soon as Tracy does something.

## Change

`platform/cch-pepper.js`. Script `20261005wo280`.

While Studio is open, a new client-portal activity line pops up on the right: who, what they did, and the project. Opening that project shows the same unseen lines. Closing the card marks them seen.

Her own preview of the portal is not logged, so opening it as herself does not pop the card.

## Verify

Hard refresh staging Studio. In another window, open the staging client portal as the client and do something. The card should appear in Studio without opening the portal.
