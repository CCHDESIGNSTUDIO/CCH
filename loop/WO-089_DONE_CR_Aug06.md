# WO-089 DONE — Client Pepper portal relay · Cursor · Aug 06

**State:** DONE-UNVERIFIED · **Build:** **9.9.97** · **Caveat:** Team Chat write needs **firestore.rules** deploy (queued with hosting)

## What shipped
| File | Change |
|------|--------|
| `platform/cch-client-pepper.js` | Portal FAB + panel; ack-only line; cooldown; writes project `messages` + staffChat relay |
| `platform/client.html` | Mount after portal paint; script `?v=20260806cp089` |
| `platform/cch-staff-chat.js` | Render `fromClient` / Pepper bubbles + Client tag |
| `firestore.rules` | Narrow unauth create for `client_pepper` → `internal/staffChat` + room unread both |

## Behavior
1. Client sees Pepper (final chip avatar); types message; Send.
2. Pepper shows only: "Thank you — I'll pass this along to the CCH team." (no AI).
3. Message → `boards/{id}/messages` (always, existing portal path).
4. Relay → Team Chat with `fromClient` / both Cindy & Vanessa `unreadBy` (requires rules deploy).
5. No "your designer" wording.

## If staffChat create is denied before rules deploy
Project Messages still receives the note; console warns. After rules deploy, both paths work. No Code handoff needed unless Cursor OOMs (did not).
