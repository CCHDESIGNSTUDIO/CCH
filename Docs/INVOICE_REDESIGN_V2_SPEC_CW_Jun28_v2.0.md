# Invoice Redesign v2 — Value-Forward Design-Services Invoice + AI Summary
**Author:** Cowork (CW) · **Date:** Jun 28, 2026 · **v2.0**
**Branch:** `wip/preserve-rh-inspiration-board-2026-04-19`
**Supersedes:** the hide/toggle approach in INVOICE_TIME_REDESIGN_SPEC_CW_Jun28_v1.0. The point is a *better* invoice, not a blanked one.
**Status:** AI function authored + wired. Front-end render = next build. Staging only; no production; agents don't deploy.

## North star
Make the design-services invoice *communicate value*. Replace the hours/rate worklog with a clean white, CCH-branded document that tells the story of the month's work as grouped design **outcomes** — drafted by AI from the ledger, edited by Cindy, sent as a finished piece. Visual target: `CCH Studio/Holtz_Invoice_Reimagined_CW_Jun28.html`.

## The three parts

### 1. AI summary — DONE (deploy is Cursor #1's)
- `functions/aiInvoiceSummary.js` → Gen2 callable `draftInvoiceSummary`, wired in `functions/index.js`.
- Input `{ notes:string[], projectName?, period? }` → Output `{ summary, outcomes:[{title,description,dateRange,hours}] }`.
- Isolation-safe: reads note text passed from client, returns text, writes nothing.
- **Deploy (Cursor #1):**
  ```
  firebase functions:secrets:set ANTHROPIC_API_KEY --project staging
  firebase deploy --only functions:draftInvoiceSummary --project staging
  ```
  (Repeat for production when promoted.) Confirm/adjust the `MODEL` string to the current Sonnet id.

### 2. Editable summary + outcomes (front-end — next build)
- Store on the invoice doc: `clientSummary` (string) and `clientOutcomes` (array of `{title, description, dateRange, hours}`).
- Editor in the invoice view (Manage side): a Summary textarea + add/edit/reorder outcome rows. Saves via the existing doc-save path — **must not** back-sync to clips/library (`cchGuardDocBackSync`); these are doc-local fields.
- "Draft with AI" button: collects the line/ledger note text for the invoice, calls `firebase.functions().httpsCallable('draftInvoiceSummary')`, populates `clientSummary` + `clientOutcomes` for Cindy to edit. Button disabled/hidden until the function is deployed.

### 3. Value-forward client render (front-end — next build)
- New self-contained renderer (e.g. `cchBuildDesignServicesInvoiceHTML(docData, items, proj, opts)`) producing the mockup layout: clean white, CCH gold wordmark header (no navy band), Prepared-for / Project / Service-period row, intro summary line (small), numbered outcomes (title + description, with optional date · hours on the right), single Total, closing note, footer.
- Wire into `previewDocument` (cch-proposals-invoices-fix.js, ~:4012) so design-services / time invoices use this renderer; product (FF&E) invoices keep the current premium render.
- `clientSummary`/`clientOutcomes` drive content; fall back to existing line description(s) when absent.
- **Date · hours are optional** (Client View hides; show when chosen) — carry the earlier toggle idea here as a single "show detail" switch, not four.

## Guardrails
- Display/data-local only; respect `cch-doc-isolation.js`. No writes to products/clips/library from invoice save.
- `platform/index.html` loads `cch-proposals-invoices-fix.js?v=...` — **bump the `?v=` tag** on every change or the browser serves the cached JS (this already bit us once).
- Large CRLF files: after any edit, `node --check` + verify the file tail (truncation risk). Build via targeted rebuild, not blind Edit.
- Staging deploy ships the whole shared working copy — coordinate with Cursor #1. Agents never deploy production.

## Changed files so far
- `functions/aiInvoiceSummary.js` (new), `functions/index.js` (one export line). Both `node --check` clean.

## Next
Front-end build (parts 2 + 3) into `cch-proposals-invoices-fix.js` + `platform/index.html`, then staging.
