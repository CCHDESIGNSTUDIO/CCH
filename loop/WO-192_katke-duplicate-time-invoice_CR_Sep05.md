# WO-192 — Katke: duplicate invoice for the same hours

**CR_Sep05** · Group C from `Docs/WO_BACKFILL_MANIFEST_MH_Aug30_v1.0.md` · **State:** OPEN · **Pri:** High · Money

## Symptom (Vanessa, Aug 11, Smart Time)

Create invoice for a set of hours appeared to no-op. She retried. Two invoices for one set of entries (Katke).

## Lead

Same class as WO-191 (no feedback → retry → duplicate write). Ground the actual create-from-time path before editing. Do not assume it is the bugs-board guard.

## Constraints

- Staging first. Production data ≠ staging.
- Do not weaken `qbDocId` re-push guard.
- Invoice tax-in-total lock still applies if the duplicate is a client invoice.
