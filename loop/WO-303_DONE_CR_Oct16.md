# WO-303 DONE — Live chat with the client on the portal

**Date:** 2026-10-16
**State:** DONE-UNVERIFIED
**Deploy:** staging hosting + firestore rules ~12:11. Studio 9.9.388. Production not deployed.

## What changed

- `platform/cch-portal-records.js` — Chat button, fixed on the client portal. Messages go to `boards/{projectId}/clientChat`. Clients can create their own messages. Staff replies are on the same thread. This is not `internal/staffChat`.
- `platform/cch-client-pepper.js` — if the client asks what they approved, Pepper answers from the checklist in the existing Pepper box, and the note still goes to the project. Cache `cch-client-pepper.js?v=20261016wo303`.
- `firestore.rules` — `clientChat` read for the portal. Unauthenticated create only when `from` is `client` and the keys are text, from, authorName, createdAt.

## Not changed

Internal staff chat. Functions were not deployed. No online-dot heartbeat was added.

## Verify

Hard refresh staging portal. Chat. Send a message. Reload. It is still there. Staff signed into Studio, same project portal, see it and can reply.
