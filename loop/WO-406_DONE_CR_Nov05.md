# WO-406 DONE — time descriptions in Notes

Cindy Nov 5, INV-6092 edit: the time text shows under the item, and Notes says + Notes.

## Cause

`cchLineExplicitNotesText` in `platform/index.html` (~10252) dropped `lineNotes` when it matched `description`. Time lines store the same sentence in both, so Notes was empty and the client letter had nothing to show.

## Change

- Service lines keep that text as Notes.
- Client letter Show notes lists each day: `Oct 2 — Room board updates and inspirations`.
- The edit row does not print the same sentence a second time under the item when Notes matches the description.

Files: `platform/index.html`, `platform/cch-invoice-redesign.js`, `platform/cch-proposals-invoices-fix.js`, `platform/client.html`. Build 9.9.483. Cache `?v=20261105wo406`.

## Self-test

`node --check` passed on both scripts. Stored invoice lines were not rewritten. Not click-tested in the browser.
