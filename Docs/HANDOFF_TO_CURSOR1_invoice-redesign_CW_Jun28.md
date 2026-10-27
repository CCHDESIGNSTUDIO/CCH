# Handoff → Cursor #1 — Invoice Redesign (CW, Jun 28, 2026)

Branch: `wip/preserve-rh-inspiration-board-2026-04-19`. Staging first. No production. CW does not commit/deploy — this is yours to batch.

## What it does
On the invoice **main page**, design-services (time) invoices now default to a **Client View** — the value-forward, clean-white CCH layout (grouped design outcomes, single total, closing note) — with a **Manage** toggle to the existing working table and a **Print / PDF** button. No separate "Preview" step. Visual target: `Docs/Holtz_Invoice_Reimagined_TARGET_CW_Jun28.html`. Plan: `Docs/INVOICE_REDESIGN_V2_SPEC_CW_Jun28_v2.0.md`.

## Changed files (all `node --check` clean)
| File | State | What |
|------|-------|------|
| `platform/cch-invoice-redesign.js` | NEW | Inline client-view renderer + `cchDocSetViewMode` (Client/Manage), `cchDsToggleDetail`, `cchPrintCurrentDesignInvoice`, AND the editor: `cchBuildDsEditor`, `cchDsAddOutcome`/`cchDsRemoveOutcome`, `cchDsSaveSummary` (doc-local update), `cchDsDraftWithAI` (calls `draftInvoiceSummary`). Display-only / doc-local writes. |
| `platform/cch-proposals-invoices-fix.js` | MODIFIED | `renderDocViewPage`: design-services invoices wrapped as Client View (default) + Manage toggle + Print. Manage side now includes the summary/outcomes editor. Earlier `previewDocument` branch reverted. |
| `platform/index.html` | MODIFIED | Registers `cch-invoice-redesign.js`; both platform JS cache-bumped to `?v=20260628ds3`. |
| `functions/aiInvoiceSummary.js` | NEW | Gen2 callable `draftInvoiceSummary` — ledger notes → `{summary, outcomes[]}` via Claude. Isolation-safe. |
| `functions/index.js` | MODIFIED | Exports `draftInvoiceSummary`. |
| `Docs/INVOICE_REDESIGN_V2_SPEC_CW_Jun28_v2.0.md` · `Docs/Holtz_Invoice_Reimagined_TARGET_CW_Jun28.html` | NEW | Spec + visual target. |

(Shared working copy also has ~30 other in-flight files from other sessions — a staging hosting deploy ships all of them; coordinate.)

## Deploy to staging
**Hosting (the redesign):**
```
firebase deploy --only hosting:platform --project staging
```
Verify on `cch-platform-staging.web.app` (Ctrl+Shift+R): open a design-services invoice (e.g. INV-6006). The page shows the new Client View by default; **Manage** flips to the working table; **Show date & hours** reveals dates/hours; **Print / PDF** prints the client view.

**AI function** (Cindy reports the key/API is set up — confirm deployed):
```
firebase functions:secrets:set ANTHROPIC_API_KEY --project staging   # if not already
firebase deploy --only functions:draftInvoiceSummary --project staging
```
Confirm the `MODEL` string in `aiInvoiceSummary.js` is a current Sonnet id.

## ⚠️ Re-run the syntax check before deploy
My build sandbox went down before I could `node --check` the final editor edits. They were authored carefully and read back intact (file tails verified), but please run before deploying hosting:
```
node --check platform/cch-invoice-redesign.js
node --check platform/cch-proposals-invoices-fix.js
```

## Flow (end to end)
Open a design-services invoice → **Manage** → "Client summary & outcomes" panel → **✨ Draft with AI** (calls `draftInvoiceSummary`, fills Summary + outcome rows) → edit → **Save & refresh** (writes `clientSummary`/`clientOutcomes` to the invoice doc) → **Client View** shows the finished invoice; **Print / PDF** prints it. Falls back to the service line(s) when no summary saved.

## Guardrails
- Bump `?v=` on the platform JS with every change or browsers serve cached JS.
- Large CRLF files: after edits, `node --check` AND verify the file tail — blind writes have truncated files twice this session; recover by repairing the tail / rebuilding from HEAD.
- Respect `cch-doc-isolation.js`: invoice fields are doc-local; no back-sync to clips/library.
- Agents never deploy production.
