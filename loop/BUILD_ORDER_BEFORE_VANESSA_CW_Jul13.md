# CURSOR BUILD ORDER — clear the daily-pain items before Vanessa starts · CW Jul 13
Goal: ship the most Vanessa-and-Cindy-facing fixes fast. Everything below is already grounded (file:line in each
WO). Work top to bottom. **Staging only; production only on Cindy's typed GO.** After every index.html edit:
`node --check` the touched JS, inspect the file tail, confirm it still ends `</body></html>` (big CRLF file =
truncation risk). Batch by file to avoid reloading index.html repeatedly.

## TIER 1 — do first, in this order (small, grounded, felt daily)
1. **WO-028 DEBUG** (`cch-progress-updates.js`) — the Bi-Weekly editor throws "Unexpected end of input." Root
   cause found: double-quoted `onclick="...JSON.stringify(...)..."` collision at :283/:411/:413/:501/:502/:696.
   Fix via the existing `cpPortalOnclickAttr` helper (or single-quote the attr). This unblocks the whole editor.
2. **WO-026** (`cch-line-icons.js`) — window-treatment "drapery" icon leaking onto every fee/credit line incl.
   Retainer Credit. Scope wtExpense to real WT context (:58-63, :77). Tiny, high daily annoyance.
3. **WO-033** (`index.html`) — invoice/PO editor footer total doesn't recalc live. Wire the shared rollup
   (@25816 + invoiceLineAmountForTotals @25737) into the docEditRenderItems path; include negative credit lines.
4. **WO-032** (`index.html`) — edit/delete payments on the invoice+PO detail rail (reuse docEditPaymentModalHtml
   @38682) **+ the retainer double-count guard** (warn + show true unclamped balance when a retainer is both a
   credit line and a payment — the INV-6051 $0-balance bug).
5. **WO-035** (`index.html`) — relabel the retainer/discount group from "Shipping & adjustments" to
   "Retainer & Discounts" (@26811 + the detail grouped-render analog); keep shipping separate.
6. **WO-027** (`index.html`) — PO summary tiles reconcile: Tile 3 → true Open Balance via cchPoListBalanceForRow
   over all POs (@63317); demote bill-due to sub-caption. Pairs with WO-016 (already done).
7. **WO-031** (`index.html` + `cch-progress-updates.js` context) — clip "Find similar" reverse-image button
   (Google Lens on imgUrl @24650) + fix the clipped "Client price…" placeholder @24668.

## TIER 2 — after Tier 1 (bigger / audit-first)
8. **WO-034** (`index.html` + QB push **cloud function**) — QB marking some fees Taxable. AUDIT first: report the
   per-line TaxCodeRef the push sends today + its source, then fix so services/fees send NON. Don't guess.
9. **WO-029** (`cch-progress-updates.js` + invoice-narrative AI location) — wire the CCH voice profile
   (`loop/CCH_VOICE_PROFILE_CW_Jul13.md`) into the invoice AI + bi-weekly generator. GROUNDING-FIRST: the invoice
   AI is not in index.html (only the classifier @48391/48510) — find it before editing. Prod change = Cindy GO.

## TIER 3 — bigger / needs Cindy before touching
10. **WO-025** Fix-It bot (LLM cloud function) — the "Bugs isn't chatting to fix" piece. Build carefully; the v1
    tracker works meanwhile, so it's last.
- **WO-020** (Order Mgmt Houzz staging close-out) and **WO-008** (room-board approval notifications, schema) stay
  **BLOCKED-DISCUSSION** — do NOT do the bulk staging write / schema change without Cindy's typed GO.

## Already DONE (do not redo — verify only)
WO-010,011,012,013,014,015,016,017,018,019,021(PhaseA),022,023,024,030 are DONE-UNVERIFIED on staging. WO-030
(Release Notes catch-up) confirmed live. If any Tier-1 edit touches those areas, don't regress them.

## Deploy rhythm — PRODUCTION FREEZE DURING VANESSA'S WORKDAY
Hard rule (Cindy, Jul 13): **no production deploys while Vanessa is working.** A mid-day prod change can break
her flow or move something under her hands. So:
- **Staging is unrestricted.** Cursor builds and deploys to staging anytime — staging does not affect Vanessa or
  clients ("changes here do not affect clients"). Do all Tier-1 building + staging deploys now.
- **Claude (Cowork) verifies each on staging** as it lands, so the batch is proven and ready.
- **Production promotion happens only in a quiet window** — before Vanessa starts, or after she's done for the
  day — and only on Cindy's typed GO. Never trickle prod changes through the workday.
- Batch the verified Tier-1 set into ONE production promotion for the next safe window, rather than many small
  ones. Fewer prod flips = less chance of disrupting her.
Suggested split if useful: invoice cluster (WO-033/032/035/027) as one verified batch, then 028-debug/026/031.
