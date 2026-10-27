# WO-322 DONE — Client chat can send a photo

Cindy Oct 22. Photo in client chat. Staging.

## Files

- `platform/cch-portal-records.js` — Photo button, upload, and the picture in the thread.
- `platform/index.html`, `platform/client.html` — Studio 9.9.407, tag `chat-photo`. Cache `cch-portal-records.js?v=20261022wo322`.
- `firestore.rules` — a client message may include an image address, and the text may be empty when there is a photo.
- `storage.rules` — an image up to 8 MB may be saved under `projects/{id}/client-chat/`.

## What changed

Client chat has a Photo button. The picture uploads, then the message is saved. Text, a photo, or both. Click the picture to open it. Staff and client both can send one.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Rules compiled on the staging deploy. A photo was not sent in the browser.

## Deploy

Staging hosting, Firestore rules, and Storage rules 2026-10-22. Production rules and production chat were not deployed.
