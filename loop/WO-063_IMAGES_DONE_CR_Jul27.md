# WO-063 follow-on — Staff chat images — DONE (Cursor Jul 27)

## What changed

Photos in Staff chat (full page `#/staffchat` + Team FAB Chat tab).

| File | Lines / area | Change |
|------|----------------|--------|
| `platform/cch-staff-chat.js` | BUILD `20260727sc3` | Photo button, paste-image, pending preview, Storage upload, bubble thumbnails |
| `platform/index.html` | `CCH_BUILD` 9.9.22; script `?v=20260727sc3` | Cache bust |

## Grounding

- Upload pattern: `index.html` ~34788–34796 (`firebase.storage().ref(path).put` + `getDownloadURL`)
- Storage path: `images/staffChat/{ts}_{safeName}` — covered by existing `storage.rules` `match /images/{allPaths=**}` (`allowedImageWrite`, 10MB)
- Message create: still append-only via `firestore.rules` `internal/staffChat/messages` (no schema change required)
- Still never client-facing (portal filters unchanged)

## Message fields (additive)

- `imageUrl`, `imageName`, `storagePath`, `imageType`, `imageSize` (optional)
- `text` may be empty when photo-only

## Self-test

- `node --check platform/cch-staff-chat.js` — pass
- Manual staging: Team FAB → Chat → Photo → Send; paste screenshot into textarea; open image in new tab; confirm no portal leak

## Deploy

Staging hosting only (no rules deploy needed). Queue line appended.
