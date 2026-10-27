# WO-265 DONE — Order Builder import no longer calls the Bartolo budget a QuickBooks PO

Cindy Oct 2, staging Order Builder. Import Workroom Estimate showed: "Detected QuickBooks PO layout but found no groups."

## Grounding

- Dialog: `platform/builder/index.html` `importBartoloEstimatePdf` hint when `fmt === "qb-po"` and `groups` is empty.
- `detectBartoloFormat` treated `$0.00` as a sub-line (`\b\d{1,2}\.\d{1,2}\s`) and checked that before Estimate + Description/Qty. A description starting with "1 Custom fabric…" then forced qb-po.
- Consolidated budget `CCH.Cloud.Rolling.Hills.Budget.Proposal.2026.pdf` is "Budget Proposal" + "Treatment Scope" + `2026-##### $pre $tax $total`. It does not say "ROOM DETAIL | ESTIMATE", so the old budget detector missed it.
- Batched source estimates `CCH Design. Cloud.Rolling Hills.budget proposal.batched.2026.pdf` are Estimate + DESCRIPTION QTY AMOUNT. 114 priced rows sum $116,638.00.

## Change

`platform/builder/index.html`

- Sub-line detection is start-of-line only (`1.1 Labor`), so `$0.00` is not a QuickBooks line number.
- Estimate / quote with Description and Qty is classified before the loose QuickBooks checks.
- Budget Proposal with Treatment Scope and an estimate number uses the budget parser.
- New room pages: one line per room, pre-tax amount, treatment scope as the description. 19 rooms sum $116,638.00.
- On an estimate, a title that is only `(Big window)` is replaced by the first sentence of the verbiage. Location stays in the description.
- Builder rev `2026-10-02wo-import-layout`.

Checked in Node against the extracted lines: budget 19 lines / $116,638; batched estimate 114 lines / $116,638; a real QuickBooks PO still detects as qb-po; a Bartolo invoice still detects as invoice.

## Not changed

Prices, markup prompt, proposal totals, work-order button, print CSS, Cloud Functions. Import still adds lines. It does not replace lines already on a proposal.
