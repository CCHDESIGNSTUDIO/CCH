# WO-190 DONE — Invoice Client View renders line notes

**Change ID:** 9.9.321  
**Date:** 2026-09-04  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging queue)

Cindy / Stone and Tile: invoice line **Concessions** had a Craft Room allocation in the line note; the document people work from showed the title only. Logged as bug 001 in `CCH_STUDIO_BUG_LOG.md`.

## Diagnosis (file:line)

- **Render drop, not missing data.** `items[].lineNotes` is on the snapshot.
- Client View `_docViewLineRowsHtml` `cch-proposals-invoices-fix.js` ~3379: `if (lineNotes && type !== 'invoice')` — invoice never got `notesHtmlInner`. Notes lived only in a `display:none` row.
- Print/PDF `_invoicePreviewTagNotesHtml` ~5115–5153 already outputs line notes. Preview was not this skip.
- Proposal Client View already rendered notes (same function, other type). PO Print uses `additionalNotes` / workroom. Tear sheets: `additionalNotes` opt defaults false (see bug log).

## Surfaces

| Intended | Must not |
|----------|----------|
| Invoice Client View / Manage line block: show Notes | Restyle Bill To / Ship To |
| Same `lineNotes` field as Print | Dump `additionalNotes` (internal / workroom) onto client invoice |

## Change

- `platform/cch-proposals-invoices-fix.js` ~3379: if `lineNotes`, always build `notesHtmlInner` (invoice + proposal).
- `platform/index.html` `CCH_BUILD` **9.9.321**; cache buster `?v=20260904note1`.
- `platform/client.html` same cache buster (loads the same module).
- `CCH_STUDIO_BUG_LOG.md` bug 001.

## Self-test

- `node --check platform\cch-proposals-invoices-fix.js`
- Grep: no `lineNotes && type !== 'invoice'` left.

## Verify after staging

Hard refresh. Sidebar **9.9.321**. Open the Concessions invoice: Craft Room note under the title on Client View and on Print/PDF. Spot-check one proposal and one PO Print.
