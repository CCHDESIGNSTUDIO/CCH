# WO-308 DONE — portal chat shows a new-message count

**State:** DONE-UNVERIFIED
**Date:** 2026-10-16
**Studio:** 9.9.392 `portal-chat-notice`
**Staging:** hosting 2026-10-16 ~14:45. Production not deployed.

## What changed

`platform/cch-portal-records.js`

- Chat stays the corner button. On a project page it is there for staff too, not only inside the client portal.
- The button reads `Chat` plus a count when the other person has written since the panel was last opened. Staff see client messages. The client sees staff messages.
- Opening the panel clears the count. A new message while the page is open updates the button.

## Not included

No email. No entry in internal staff chat. A client message from the real portal still logs to activity. A message sent from the studio preview does not.
