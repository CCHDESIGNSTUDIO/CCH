# CCH Studio bug log

Logged from Cindy’s Stone and Tile / invoice note report (Sep 4, 2026). Cursor grounded the code the same day.

---

## Bug 001 — Invoice line note does not render (Craft Room / Concessions)

**Severity:** High (schedule accuracy). The allocation lives on the invoice line in Firestore and vanishes on the document the client and fabricator work from.

**Symptom:** Invoice line titled **Concessions** with a note about the **Craft Room** allocation. Client View / printed invoice showed the title only. Stone and Tile schedule source line corrected to record that the allocation is on the invoice but did not render.

### 1. Dropped at render, or never passed to the template?

**Dropped at render** on Client View / Manage. The snapshot field is passed in.

| Path | What happens |
|------|----------------|
| Firestore | `items[].lineNotes` (and aliases `lineNote`, `clientNotes`, `notes`) stay on the sent invoice. Not a missing-write bug for `+ Notes`. |
| Client View / Manage (`renderDocViewPage`) | **Dropped.** `cch-proposals-invoices-fix.js` `_docViewLineRowsHtml` built `notesHtmlInner` only when `type !== 'invoice'`. Invoice lines got a hidden Notes textarea (`display:none`) and no Notes block under the title. |
| Print / PDF (`previewDocument` → `_premiumAppendLineRow`) | **Passed.** `_invoicePreviewTagNotesHtml` reads `cchLineExplicitNotesText` and writes `.line-notes`. Preview/PDF already had the field. |
| Send email | **Never includes line items.** Mailto is dashboard link + amount. Recipients see whatever Client View / Print shows after they open the invoice. |
| QB push | **Passed** into Description (`Functions/index.js` ~1650–1662: title + description + `lineNotes` + room). |

**Second field (do not confuse):** Edit also has **Include additional internal note** → `additionalNotes` / `workroomNote`, placeholder *“Workroom / schedule (not on client preview)”*. Invoice Print does **not** use that field. PO Print **does** (`workroomUnder`). If Craft Room was typed there, it is still on the doc and still omitted from the client invoice by that gate.

### 2. Proposals, POs, tear sheets?

| Surface | Same `lineNotes` field | Renders? |
|---------|------------------------|----------|
| **Proposal** Client View + Print | Yes | **Yes.** Same helper; the skip was invoice-only. |
| **PO** Print | `lineNotes` plus `additionalNotes` | **Yes** for workroom/additional; specs + “Notes:” under the item. Fabricator PO PDF is not this bug. |
| **Tear sheets** (`generateTearSheetsFromDoc`) | Mixed | **Partial.** Invoice meta copies `lineNotes` into `additionalNotes`, but default tear-sheet opts have `additionalNotes: false`. Notes only appear as body copy when description is empty. Include Tear Sheets on Preview is a stale second engine (title/qty/price; no notes). |

### 3. Already-issued invoices?

**Yes, if the note is in `lineNotes`.** Data is still on the sent docs. They do not need a Firestore rewrite. After staging/prod hosting of this fix, Client View and a fresh Print/PDF show the note. PDFs already saved or forwarded stay wrong until reprinted. Emails never contained the note text.

**WO-190** (9.9.321): removed the `type !== 'invoice'` skip so Client View paints Notes under the line. Print path unchanged (already had the field). Staging queue; no same-session production GO.

### Verify

1. Invoice with `+ Notes` text (Concessions / Craft Room). Client View: Notes block under the title, not only behind the button.
2. Print / PDF: same Notes text.
3. One proposal, one PO Print: notes still present.
4. If a line still prints title-only: open Edit → if the text is only under **Include additional internal note**, that is the internal field, not `lineNotes`.
