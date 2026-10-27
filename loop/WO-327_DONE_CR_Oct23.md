# WO-327 DONE — Project chat shows a waiting notice

Cindy Oct 23. Client chat on the project had no notice.

## Files

- `platform/cch-portal-records.js` — `unansweredClientCount` and `paintChatButton`. The number sits in the button.

## What changed

On the project, Client chat turns gold and reads New chat plus a count while the latest messages are from the client and staff has not replied. Opening the panel does not clear that. A reply from staff does. Messages staff sent do not light it. The count is inside the button, not on Pepper’s photo.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Not clicked in the browser.

## Deploy

Staging hosting 2026-10-23 with Studio 9.9.412. Production not deployed.
