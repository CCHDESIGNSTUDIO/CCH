# WO-122 DONE · Pre-save markup check; paid and locked prices unchanged · CR Sep 24

**Ledger:** WO-122. **State:** DONE-UNVERIFIED. **Not verified. Not production.**

## What Cindy asked

Warn before a client price is saved when markup is missing or is not 20%, 35%, or that project's default. A price that is just the studio's rounding of 20% or 35% still counts. Do not change any price. Nothing already paid can change. No migration.

## Rounding (confirmed in code)

`cchRoundClientUnitPriceUp5` in `platform/index.html` is **round up to the next $5** (`Math.ceil(n / 5) * 5`), from WO-093. It is not $0.05. The check still treats a nearest-nickel price, a nearest-dollar price, and a next-$5 price as the allowed percent, so none of those roundings false-alarm.

## Locked — the check does not prompt, re-price, re-round, or re-save these

- Any recorded payment (`payments[]`, `paidAmount`, `amountPaid`, `totalPaid`), status Paid / Partially Paid / Partial, or QuickBooks paid / partial.
- Proposal status Approved or Signed, or `clientApprovedTotalAt` (client approved the total).
- A proposal line already copied to an invoice (`invoicedOnInvoiceId`, or the existing invoiced-line rule). A fully invoiced proposal is locked as a document.
- Void or cancelled.
- A line that is only approved or declined on a still-open proposal is **not** locked. Draft, Published, Sent, and In Review are **not** locked.

On those locked records the new code restores price fields after the document editor's save sync, skips pushing prices onto room-board clips, and refuses inline price edits and line-editor saves. At most a one-time note: prices were left unchanged. Payment rows are never written by this check.

## Left unchanged on purpose (risk)

- Opening a proposal in **edit** mode can still fill an empty cost or client price from the library, including the $5 round (`cchProposalFillEmptyEconomicsFromLinkedSources`). It does not look at paid or approved.
- On an **unlocked** document, Save and autosave still round the client unit up to the next $5 when cost is present (`docEditSyncLineItemsFromDom`). Save anyway does not add a second change, but that existing round still runs.
- `pushLibraryPricesFromLineItem` and `syncProductToClips` do not run from a document save: document isolation blocks them. `syncProductToClips` returns without writing.
- Bulk trade-cost update (`cch-cost-lock.js`) skips sent, paid, and overdue invoices, but not a document whose status is still something else while a payment is on file.
- Sending still updates status. This check does not add a price write on send.

## Deploy

Staging only, after review. No production. No database backfill.

`_DEPLOY_QUEUE.md` is gitignored. Line for the queue: `2026-09-24 WO-122 staging hosting only — markup pre-save check. No prod. No data writes.`
