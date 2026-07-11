# WO-006 DONE · Invoices compact stat row · Cursor 1 · Jul 11, 2026

**Change ID:** pending #1 assign (BF) · **State:** DONE-UNVERIFIED · **Executor:** Cursor 1 · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | `renderInvoicesTab` — replaced centered "Open Balance Due" hero with 3 compact WO-005-style cards |

## Behavior

1. **Total Invoiced** — sum + sent invoice count (tan accent).
2. **Paid** — collected sum + % collected subtitle (green accent).
3. **Open** — open balance + open-invoice count (red/green accent).
4. Stats use `_projFinancialsCanonical` when available so totals match Financial Health strip.
5. Show Markup toolbar row restyled white (no gray panel).

## Verify (Claude, staging)

- Project → Invoices tab: three compact cards above table; less vertical space than old hero block.
- Card totals match Financial Health Invoiced / Paid / Outstanding for same project.
- Console — zero errors.

## Deploy

Staging handoff appended to `_DEPLOY_QUEUE.md`.
