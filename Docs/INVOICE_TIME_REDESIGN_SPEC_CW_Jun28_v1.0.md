# Invoice Redesign Spec — Design-Services (Time) Invoices
**Author:** Cowork (CW) · **Date:** Jun 28, 2026 · **v1.0**
**Branch:** `wip/preserve-rh-inspiration-board-2026-04-19`
**Status:** Spec only — no code written. Staging-first. Hand changed-file list to repo owner #1; no commit/deploy by agents.

---

## North star
**Make more money.** This invoice is the underbilling pattern made visible (see Holtz example: 35.5 hrs × $75 = $2,662.50 for construction-documentation + lighting work). This spec covers the **presentation** half — removing the hours/rate gate so an outcome-based document can carry a higher rate without friction. **The rate correction itself ($75 → $295/$350) is a separate build (see Follow-up).** Presentation is the enabler; the rate is the revenue. Do not conflate them.

## Governing philosophy
`cch-cfo` skill: invoices present **outcome and phase, not hours or rate**. Clients never see hour count, hourly rate, or internal time breakdown. Detail exists internally and is shared **only on request**, never pre-printed.

---

## Scope (this session)
Client-facing presentation only. **No amounts change** — stored totals render exactly as today.

1. **Hide hours + rate on design-services lines.** Suppress the Qty (hours) and Price (rate) cells for service lines; show the outcome title, service period, and Total only.
2. **Replace the timestamped notes dump** with a curated outcome summary (default), with the per-entry log moved into a **collapsed/expandable** detail (available, not pre-printed).
3. **Keep:** Service period line, the "Design Services" section grouping, Total, and product/shipping/tax behavior — all unchanged.

### Out of scope (this session)
- Any change to line amounts, `rate`, `qty`, or stored totals.
- `billingCategories` rate values.
- Product-line (FF&E) presentation — only design-services/time lines change.

---

## Where it renders (grounded — file:line)
All in `platform/cch-proposals-invoices-fix.js`:

- **Premium client preview** (the screenshot): section starts `// 32. PREMIUM PREVIEW` at **:4010**.
- Column model for invoices: colgroup at **:4183**; headers `Item / Qty / Price / Shipping / Total` at **:4395–4401**.
- Service-line flag already exists: `isSvc` used at **:4290** (`if (_showPremiumImgCol && !isSvc)`) — this is the hook to branch presentation for service lines.
- Notes block builder: `_invoicePreviewTagNotesHtml(it)` at **:4216**, consumed at **:4332** (`notesUnder`). Currently rendered expanded — this is the timestamped dump.
- Service period already rendered: `item-svc-period` at **:4327–4329** (keep as-is).
- Collapsed-detail pattern already exists elsewhere: `<details class="cch-inv-line-details">` at **:3140** (reuse this idiom for the client view).
- Already-done philosophy groundwork (do not duplicate): `buildInvoicePreviewGroupedByDesignServices` **:3893**, `sanitizeInvoicePreviewLineText` **:3906**, `sanitizeInvoiceDocMemoHtml` **:3914**, `invoiceLineDisplayTitle` **:3918**.

---

## Behavior spec

### Design-services line (when `isSvc` / non-product service bucket), client/premium preview + PDF:
- **Qty cell:** render empty (or `—`). Do **not** print the hour count or "hr/hrs" unit label (currently from `unitLbl` at index.html:3142 path / premium row).
- **Price cell:** render empty (or `—`). Do **not** print the per-hour rate.
- **Total cell:** unchanged — stored line total.
- **Title:** `invoiceLineDisplayTitle(it)` (already real service name).
- **Service period:** keep `item-svc-period`.
- **Description line:** strip any "N hours — …" prefix. If the description is literally "<n> hours — design services", replace with the outcome title only.

### The "all of the above" detail model (per Cindy):
Default view, in order:
1. **Outcome line** — service title + Total.
2. **Service period** — existing line.
3. **Curated outcome summary** — 1–2 sentences describing *what was accomplished* (outcomes, not a worklog). E.g. "Construction documentation, lighting design, and millwork coordination — Master Suite & Lower Level."
4. **Collapsed detail** — the existing per-entry log, wrapped in `<details>` (summary label like "Detail available on request"), **collapsed by default**, so it prints clean but is there if a client asks.

### Open design decision (needs Cindy's call before build)
The **curated outcome summary does not exist in the data today** — only per-entry `notes`/`description` with timestamps. Options:
- **(A)** Add an optional per-line `serviceSummary` field, entered when building the invoice (most control, manual).
- **(B)** Auto-derive a summary from the entry notes (e.g. dedupe + group the construction-doc / lighting / window-treatment themes) — less work for Cindy, less control.
- **(C)** Ship presentation now with summary = blank/optional; collapse the log; add the summary field later.
Recommend **(C)** to unblock the visible win, then **(A)** as a fast follow.

---

## Guardrails (mandatory)
- **Document isolation** (`cch-doc-isolation.js`, `.cursor/rules/document-isolation.mdc`): this is display-only over snapshot data — must not write any field back to clips/library or trigger sync. No new save/edit paths.
- Edit `platform/cch-proposals-invoices-fix.js` directly with find/replace; **do not** split files or write Node patch scripts (CLAUDE.md).
- **Staging deploy only** (`firebase deploy --only hosting:platform --project staging`); verify on `cch-platform-staging.web.app`. **No production deploy.** Hand changed-file list to repo owner #1.
- Code Grounding Protocol: re-grep before implementing; line numbers above will drift.

---

## Follow-up build (the actual revenue lever — separate spec)
1. **Rate correction in `billingCategories`** (index.html:3484): move design-services off $75/$125/$195 toward **$295 long-term / $350 new-client floor**; add a guard that flags/blocks new project lines below the floor.
2. **Procurement margin discipline** (60/40 model) — confirm product markup is holding margin, since that is the primary revenue engine per the CFO philosophy.
3. Backfill: identify open/recent design-services invoices billed below floor (Holtz is one) as candidates for the rate conversation.
