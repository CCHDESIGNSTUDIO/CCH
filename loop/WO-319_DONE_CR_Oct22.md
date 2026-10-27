# WO-319 DONE — Meeting note opens with a subject

Cindy Oct 22. Edit did not open the note. She asked for a subject line.

## Files

- `platform/cch-portal-records.js` — subject field on the form and on the card. Clicking the subject or Edit moves the editor into that note. Save writes `subject`.
- `platform/index.html` — Studio 9.9.403, tag `meeting-note-open`. Cache `cch-portal-records.js?v=20261022wo319`.
- `platform/client.html` — same cache buster.

## What changed

A saved note had no title. Edit filled a form at the top of the page, so the note she clicked did not open. The subject is the heading. Edit and the subject open the editor inside that note, with a navy border, and the Subject box is focused. Cancel puts the new-note form back at the top. Older notes show “No subject” until one is typed. Clients see the subject only after the note is published.

## Self-test

`node --check platform/cch-portal-records.js` exit 0. Not verified in the browser yet.

## Deploy

Staging hosting. Production not deployed.
