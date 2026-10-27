# WO-317 DONE — Open a meeting note and publish it

Cindy Oct 22. Cloud Rolling Hills meeting notes. A saved draft had no way to open it or publish it.

## Cause

`meetingCard` in `platform/cch-portal-records.js` rendered the text only. `wireMeetings` only created a new document. Save draft wrote `status: draft`. Publish to portal was only on the new-note form.

## Change

Staff see Edit, Publish (on a draft), and Delete on each note. Edit loads that note into the form, including the staff-only box. Save draft updates it and leaves it a draft. Publish to portal, or Publish on the card, sets `status: published`. Delete asks in the styled confirm, then removes the note and the staff-only text. A published note stays published if you save it again. Clients still have no edit or delete. Print was not changed.

`platform/index.html` and `platform/client.html` cache `cch-portal-records.js?v=20261022wo317`. Studio 9.9.401.

## Self-test

`node --check` exit 0.

## Verify

Hard refresh staging. Cloud Rolling Hills, Meeting notes. The Oct 7 draft shows Edit, Publish, and Delete. Edit opens the note. Publish removes the Draft label. Tracey’s portal does not show it until Publish.
