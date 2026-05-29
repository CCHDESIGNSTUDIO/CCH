# SPEC — PO → Bill → Client Invoice Variance Workflow

**Version:** 1.0
**Status:** Spec for staging implementation
**Author:** Claude (drafted from Cynthia's requirements May 27, 2026)
**Implementer:** Cursor (next session)
**Target environment:** Staging first (`cch-studio-staging`). Production after Cynthia signs off on staging.

---

## 1. Goals

1. Stop the Houzz pain: vendor sends a final invoice with surprise freight → staff edits the PO retroactively → QB bill doesn't match the bank transaction → re-edit cycle. End that loop.
2. Surface every variance between what we ORDERED and what the vendor actually CHARGED.
3. Make it one-click to either invoice the client for the variance or mark it absorbed.
4. Give a firm-wide view of variances so cash leakage stops being invisible.

## 2. Non-goals

- **No Studio → QB push of payments.** Studio records payments for reference only. QB independently creates bills and matches transactions. QB webhook tells Studio when bank-side clears (per existing `qbWebhook` Cloud Function).
- **No automatic line-item edit of POs after send.** PO becomes immutable once sent to vendor. The Bill captures all post-send actuals.
- **No automated variance-resolution decisions.** Studio surfaces variances; humans classify them.

## 3. Background — the actual problem we're solving

Quote from Cynthia (May 27, 2026):

> "even though a vendor sent us a final invoice and charge alot of them charge shipping seperate etc its a bitch.. and so the transaction and the 'bill' didn't match - then we had to go back and change the Houzz po, add the payment etc... there has to be a better way"
>
> "and then if there's a difference and the shipping we also have to invoice the client so we need a discrepancy report"

Houzz forced PO and bill into the same document. When freight came in, you edited the PO. That broke audit history AND broke QB matching. The variance to invoice forward to the client was lost in the editing chaos.

The fix: **three separate documents**, each frozen at its own time:

| Doc | When created | Frozen | Represents |
|---|---|---|---|
| PO | Order placed with vendor | When "Send to Vendor" clicked | What we agreed to buy |
| Bill | Vendor's actual invoice received | When "Receive Final Bill" submitted | What the vendor actually charged |
| Bank transaction | Bank clears the payment | On bank statement | What actually left our account |

The variance (Bill - PO) is captured as its own data point and either flows to the client invoice or gets marked absorbed.

---

## 4. Firestore schema changes

### 4.1 PO doc — new fields on `boards/{boardId}/purchaseOrders/{poId}`

```js
{
  // ... existing fields (number, total, items, vendor, etc.) ...

  // === NEW: PO lifecycle ===
  poStatus: 'draft' | 'sent' | 'bill_received' | 'paid' | 'cleared' | 'closed' | 'voided',
  poLocked: boolean,             // true once "Send to Vendor" clicked
  poSentAt: ISOString | null,
  poSentBy: emailPrefix | null,  // 'cindy' / 'vanessa'

  // === NEW: Bill from vendor ===
  bill: {                        // null until "Receive Final Bill" submitted
    received: boolean,
    receivedAt: ISOString,
    receivedBy: emailPrefix,
    vendorInvoiceNumber: string,
    vendorInvoiceDate: ISOString,
    poTotalAtSend: number,       // snapshot of PO total when sent (for variance calc)
    items: [
      { lineId: string, source: 'po' | 'freight' | 'tax' | 'extra', title, amount, ... }
    ],
    freight: number,              // sum of source='freight' lines
    tax: number,                  // sum of source='tax' lines
    extras: number,               // sum of source='extra' lines
    billTotal: number,            // poTotalAtSend + freight + tax + extras
    notes: string,
  } | null,

  // === NEW: Variance ===
  variance: {                    // null if no bill received OR billTotal == poTotalAtSend
    amount: number,              // billTotal - poTotalAtSend (signed)
    reason: 'shipping' | 'tax' | 'expedited' | 'restocking' | 'cc_fee' |
            'price_increase' | 'vendor_discount' | 'other',
    resolution: 'pending' | 'billable_to_client' | 'absorbed' | 'refund_due_client',
    resolutionNote: string,
    resolvedAt: ISOString | null,
    resolvedBy: emailPrefix | null,
    linkedClientInvoiceId: string | null,    // when billable_to_client, points to the
    linkedClientInvoiceLineId: string | null, // invoice + line that captured the variance
  } | null,

  // === NEW: Payment (reference only — Studio side, NOT pushed to QB) ===
  paymentRecorded: {             // user records what they paid the vendor
    amount: number,
    method: 'cc' | 'check' | 'wire' | 'ach' | 'zelle' | 'other',
    recordedAt: ISOString,
    recordedBy: emailPrefix,
    referenceNumber: string,     // CC last 4, check #, etc.
    notes: string,
  } | null,

  // === NEW: Payment cleared via QB webhook (one-way: QB → Studio) ===
  paymentCleared: {
    amount: number,
    clearedAt: ISOString,
    qbBillId: string,
    qbBillPaymentId: string,
    qbTransactionId: string,
  } | null,
}
```

### 4.2 New collection: `boards/{boardId}/notifications/{auto}`

Watched by Studio UI for the BIG notification system (item 3a in `CURRENT_PRIORITIES.md`).

```js
{
  type: 'qb_payment_matched' | 'variance_flagged' | 'po_sent' | ...,
  poNumber: string,
  poId: string,
  projectId: string,
  amount: number,
  createdAt: ISOString,
  seenBy: [emailPrefix],     // marks who acknowledged
  expiresAt: ISOString,      // optional auto-cleanup
  data: { ... type-specific payload ... },
}
```

### 4.3 Migration: backfill existing POs

For every existing PO doc, set:
```js
{
  poStatus: 'sent',           // assume already sent (most existing POs are)
  poLocked: true,
  poSentAt: <createdAt>,
  poSentBy: 'system-migration',
  // bill, variance, paymentRecorded, paymentCleared remain null
}
```

Skip docs that already have `poStatus` set. Manifest written for audit.

---

## 5. UI — index.html changes

### 5.1 PO detail page — header status

Replace the existing single status badge with a 4-step pipeline indicator:

```
[Draft] → [Sent] → [Bill Received] → [Paid] → [Cleared ✓]
```

Active step is highlighted. Past steps are checkmarked with date hover.

### 5.2 "Send to Vendor" action

New button on PO detail when `poStatus === 'draft'`. Opens confirm modal:

> Lock PO and mark as Sent?
> Once sent, line items and total cannot be edited.
> If the vendor's final invoice differs, use Receive Final Bill.

On confirm:
- Sets `poStatus: 'sent'`, `poLocked: true`, `poSentAt`, `poSentBy`
- Snapshots current total into a hidden `poTotalAtSend` field (used later for variance calc)
- Writes to `boards/{}/notifications/{}` with type=`po_sent` (small toast, not BIG)

### 5.3 "Receive Final Bill" action

New button on PO detail when `poStatus === 'sent'`. Opens a modal:

```
Receive Final Bill — PO-12345 (Restoration Hardware)

Vendor's invoice #:   [_____________]   Vendor invoice date: [____]

Original PO total: $34,673.76   (locked, from when PO was sent)

Add bill lines beyond original PO:
  [+] Freight                  $___
  [+] Tax                      $___
  [+] Other / Extra            $___    [description: _______]

Final Bill total:    $34,972.76  (auto: $34,673.76 + entries above)

Variance vs PO:      +$299.00    🟡 needs classification

[Save Bill]   [Cancel]
```

On save:
- Writes the `bill` object to the PO doc
- If `billTotal !== poTotalAtSend`, writes the `variance` object with `resolution: 'pending'`
- Sets `poStatus: 'bill_received'`
- Writes `notifications/{}` with type=`variance_flagged` if variance ≠ 0
- Banner notification fires: "PO-12345 variance: +$299 needs classification"

### 5.4 Variance resolution UI (on PO detail when `variance.resolution === 'pending'`)

A yellow callout card:

```
⚠️ Variance flagged: +$299.00 over the PO

Reason:        [Shipping ▼]   (Shipping / Tax / Expedited / Restocking / CC Fee / Price Increase / Other)
Resolution:    ( ) Bill to client      ( ) Absorbed       ( ) Refund due to client
Note:          [________________]

If "Bill to client":
   Add to invoice: [Select invoice ▼]  (default: most recent draft invoice on this project)
   Or: [Create new client invoice line]

[Resolve]   [Snooze 24h]
```

On resolve:
- Writes `variance.resolution`, `variance.reason`, `variance.resolvedAt`, `variance.resolvedBy`
- If billable: writes the line onto the chosen invoice and stores `linkedClientInvoiceLineId`
- Clears the dashboard variance count

### 5.5 Project Financials → new "Discrepancies" tab

Table per project. Columns:

| PO | Vendor | Ordered | Billed | Variance | Reason | Resolution | Client Invoice |

Filter chips: All / Pending / Billable / Absorbed / Refund Due

### 5.6 Firm-wide Discrepancy Report

New page in sidebar under Intelligence: **Discrepancy Report**

- All projects in one table
- Default filter: `Pending`
- Group by vendor (shows "Restoration Hardware has $4,127 in unresolved variances across 17 POs")
- Group by reason
- Export to xlsx button

### 5.7 Dashboard widget

Top-right of main dashboard:

```
⚠ 5 PO variances pending  $1,247 unresolved
[Review →]
```

Links to firm-wide Discrepancy Report filtered to `Pending`.

---

## 6. Notifications

Three layers, all watching `boards/{}/notifications/`:

| Trigger | Layer | Auto-dismiss |
|---|---|---|
| `po_sent` | Toast (small, bottom-right) | 4s |
| `variance_flagged` | Banner (top, yellow) | 8s + persistent in Discrepancy Report |
| `qb_payment_matched` | **MODAL** (centered, click-OK) | Never — must acknowledge |
| `variance_resolved` | Toast | 4s |

The `qb_payment_matched` modal is the BIG notification per `CURRENT_PRIORITIES.md` item 3a. Shows: PO number, vendor, amount, date QB cleared, link to QB.

---

## 7. Cloud Function changes

### 7.1 `qbWebhook` (Functions/index.js — exists already)

Already handles `BillPayment` events per `Docs/SESSION_LOG_Cursor_2026-05-20.md`. Extend to:

- When a `BillPayment` matches a Studio PO (by `qbBillId`):
  - Write to PO: `paymentCleared: { amount, clearedAt, qbBillId, qbBillPaymentId, qbTransactionId }`
  - Set `poStatus: 'cleared'`
  - Write to `boards/{boardId}/notifications/{auto}` with type=`qb_payment_matched`

### 7.2 Optional: nightly variance digest function

Scheduled function (Cloud Scheduler, daily 7am PT) that:
- Counts pending variances firm-wide
- If > 0, writes a `notifications/digest_{date}` record
- (Optional later: emails Cindy a summary)

---

## 8. Variance classification taxonomy

Default classifications per reason — staff can override per row:

| Reason | Default | Notes |
|---|---|---|
| `shipping` | `billable_to_client` | Most common variance |
| `tax` | `billable_to_client` | Client owes actual tax |
| `expedited` | `billable_to_client` (with note) | Often client requested |
| `price_increase` | `billable_to_client` + flag for approval | May need client OK first |
| `restocking` | `absorbed` | Usually our mistake |
| `cc_fee` | `absorbed` | Not passable |
| `vendor_discount` | `refund_due_client` | Negative variance |
| `other` | `pending` | Force manual review |

---

## 9. Edge cases

| Case | Handling |
|---|---|
| PO sent, vendor cancels order entirely | "Void PO" action → `poStatus: 'voided'`. Bill never received. |
| Bill received, then vendor sends a credit memo | New "Receive Credit Memo" action. Creates a negative bill line. Variance recomputes. |
| Partial bill (PO split across two shipments) | First "Receive Final Bill" sets `bill.partial: true`. PO doesn't transition to `paid` until partial flag cleared. Second receive merges into the same bill doc. |
| Bill received before any payment recorded | OK. `poStatus: 'bill_received'` is its own state. Can sit there indefinitely. |
| Payment recorded but no bill received yet | OK. Studio shows "Payment recorded — bill not yet received." Variance is `null` until bill comes in. |
| QB webhook fires but PO already shows cleared (duplicate event) | Idempotent: skip if `paymentCleared.qbBillPaymentId` already matches. |
| Client invoice already sent + paid, then a PO variance is discovered later | "Bill to client" action allows creating a new line on a NEW follow-up invoice. Original invoice not modified. |

---

## 10. Acceptance criteria (staging)

Done when, on staging:

- [ ] One existing PO can be transitioned through Draft → Sent → Bill Received → Paid → Cleared
- [ ] "Send to Vendor" locks the PO total and items
- [ ] "Receive Final Bill" modal saves the bill data and computes variance
- [ ] A variance with non-zero amount surfaces in the project Discrepancies tab
- [ ] A variance can be resolved as "billable to client" → adds a line to a chosen client invoice
- [ ] A variance can be resolved as "absorbed" → marked done, no client invoice change
- [ ] Firm-wide Discrepancy Report aggregates across boards
- [ ] Dashboard widget shows correct pending count
- [ ] Migration script backfills existing POs with `poStatus: 'sent', poLocked: true`
- [ ] Bill received does NOT push anything to QB (one-way confirmed)
- [ ] `qbWebhook` writes `paymentCleared` and creates a `qb_payment_matched` notification
- [ ] BIG notification modal appears when `qb_payment_matched` fires
- [ ] No regression in existing PO/invoice rendering

Verify on these specific staging POs after migration:
- PO-400024 (7225 Bugletrail / RH, known $4,172 stub gap)
- PO-400082 (7225 Bugletrail / Visual Comfort, $28 freight variance pattern)
- PO-12935 (Bradbury High Drive / Universal Upholstery, $199 legacy variance)

---

## 11. Out of scope (v1.0)

These are NOT in this spec. Track separately if/when requested:

- Auto-creating bills in QB via Studio (one-way QB→Studio only for v1.0)
- Vendor-side bill upload (PDF/image attach to bill)
- Approval workflow for variance resolutions over a threshold (e.g., > $1,000)
- Multi-currency
- Bulk variance resolution UI
- Email notifications to Cindy
- Client-side visibility of variances (clients don't see this)

---

## 12. Related docs

- `cch-deploy/Docs/CURRENT_PRIORITIES.md` — item 3a (BIG notification) and the new item for this workflow
- `cch-deploy/Docs/CLEANUP_HISTORY.md` — Re-Import Guard Rules (must not let any future Houzz import overwrite the new fields)
- `cch-deploy/Docs/SESSION_LOG_Cursor_2026-05-20.md` — existing `qbWebhook` documentation
- `CCH_Platform_Docs/_architecture/sessions/INTERNAL_INVOICE_EDIT_VIEW_HOUZZ_ALIGN_CR_May22_v1.0.md` — May 22 invoice edit/view split

---

## 13. Implementation order recommendation for Cursor

1. **Schema migration first** — backfill existing PO docs with `poStatus`, `poLocked`. Dry-run, then apply on staging. Manifest required.
2. **Read-side first** — update PO list/detail rendering to handle the new fields gracefully (null-safe). Existing POs should look unchanged.
3. **"Send to Vendor" action** — smallest new feature. Test it works without breaking existing flows.
4. **"Receive Final Bill" modal** — biggest piece of new UI. Build with proper validation.
5. **Variance resolution UI** — the callout card on PO detail.
6. **Project Discrepancies tab** — read-only first, then add filters.
7. **Firm-wide Discrepancy Report** — last UI piece.
8. **Cloud Function extension** — extend `qbWebhook` to write notifications + `paymentCleared`.
9. **BIG notification UI layer** — watches `boards/{}/notifications/` and surfaces modal/banner/toast.
10. **Dashboard widget** — final polish.

After staging acceptance: same scripts/migration target production with `--production` flag and Cynthia's typed approval.

---

*End of spec v1.0.*
