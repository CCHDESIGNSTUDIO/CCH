# WO-196 — Declined line items still print on approved-items PDF

**CR_Sep05** · Group C · **State:** OPEN · **Pri:** Med · Print

## Symptom (Vanessa, Aug 27, greene-hixson)

Declined line items still print on the approved-items PDF. Cited **PRO-3044**.

## Print-surface lock (non-negotiable)

This is the shared print/PDF layer. Staging only. No same-session production GO.

Verify the set, not the trigger: **one PO, one sent invoice, one sent proposal, one tear sheet.**

Grep every `type ===` gate before editing. If the gate names some document types and not others, say so in chat before editing.

## Constraints

- Do not restyle Bill To / Ship To / line items to make one document match another.
- Convert-to-invoice already copies approved lines only (WO-147). This order is **print of approved-items**, not convert.
