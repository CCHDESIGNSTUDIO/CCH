# WO-203 DONE — Line NOTE: on proposal, invoice, and PO

**Change ID:** 9.9.324  
**Date:** 2026-09-05  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 5 INV-6014 Print: “This is option for the Butler Pantry” sat under catalog copy with no label. Whole point is the note on **proposal, invoice, and PO**.

## Diagnosis (file:line)

- Print `itemInner` `cch-proposals-invoices-fix.js` ~5329: `type === 'po' ? '' : (… notesUnder)` — **PO Print never painted `lineNotes`.** Only `additionalNotes` / workroom italic after specs.
- Invoice Print `_invoicePreviewTagNotesHtml` ~5148: note used `item-desc line-notes` with **no label**, after Description.
- Client View ~3425: notes after description; gold “Notes” matched the Description header.

## Surfaces

| Intended | Must not |
|----------|----------|
| Proposal, invoice, PO — Client View + Print/Preview line block | Bill To / Ship To restyle |
| Bold **NOTE:** on its own line, then the note, **above** Description/specs | Dump `additionalNotes` (workroom) onto invoice/proposal |
| | Tear sheets (separate renderer; not this pass) |

PO Print still shows workroom `additionalNotes` after specs (existing). **NOTE:** is `lineNotes` (+ Notes).

## Change

- Shared `_cchLabeledNoteHtml`: **NOTE:** 700 navy, then body.
- Print: `notesUnder` for all three types, inserted after title, before specs/Description.
- Client View: same label; `notesHtmlInner + descHtmlInner`.
- Studio **9.9.324**. `cch-proposals-invoices-fix.js?v=20260905note2`.

## Self-test

- `node --check platform\cch-proposals-invoices-fix.js`
- File tail intact.

## Verify after staging

Hard refresh. Sidebar **9.9.324**. INV-6014 Print: **NOTE:** then Butler Pantry, then Description. One proposal Print. One PO Print (line with `lineNotes`). Tear sheet spot-check: unchanged unless a line already showed notes.
