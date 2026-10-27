# WO-278 DONE — Pepper pushes the order list

Cindy Oct 5. Grok’s Oct 1 and Oct 4 notes. Try on staging. Pepper reads and reminds.

## Change

`platform/cch-pepper.js` and the script tag in `platform/index.html`.

After 8:00, staff see a card, “Orders that need you,” without opening Pepper. It lists up to 8 purchase orders already flagged by Order Management: draft and not sent, no vendor confirmation, or missing vendor bill. Each line opens that purchase order. Close hides it until the afternoon. Snooze hides it until tomorrow. Opening a project shows a second card for that project, with a color stripe for Rolling Hills, Holtz Hill, Shimano Maverick, and West Avalon.

The chat still waits until someone opens Pepper.

## Not in this pass

Email. Paid lines that have no purchase order. Client approvals since yesterday. Portal Pepper still greeting Cindy as the client. Phase 2 drafts.

## Not deployed

A hosting deploy would ship the other uncommitted platform files. Production is unchanged.

## Verify

After a staging hosting deploy: hard refresh https://cch-platform-staging.web.app. The order card should appear without tapping Pepper. Open Cloud Rolling Hills. The project card stripe is orange.
