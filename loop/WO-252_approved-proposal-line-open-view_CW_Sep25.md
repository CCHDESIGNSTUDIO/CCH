# WO-252 — Approved proposal: still open line for notes / images / product link
**Change ID:** pending #1 assign · **State:** OPEN · **Lane:** A production bug · **Executor:** Cursor #1 · **Verifier:** Cindy

## Cindy Sep 25 (PRO-3047 / Tracey Cloud — Rolling Hills)
She opened PRO-3047 (Approved, on client portal, $6,222, 3 approved lines). Clicking into a line hits **"Cannot edit line"** / *The client already approved this proposal and its total…*

**Her words:** somehow locked out of looking at the detail of a line once it’s been approved — fucked up. She still needs to **add notes**, **open / see / add images**, and **see the link to the product**.

## Root (grounded live PC repo)
`platform/index.html` → `editDocLineItem`:
- Calls `proposalDesignerLineEditLocked(prop)` **before opening** the line modal.
- If `clientApprovedTotalAt` is set → alert + **return** (blocks open entirely).

That over-locks. Money / qty / markup must stay locked after client total approval. **View + notes + images + product URL must stay available.**

## Change
1. Opening a line on a client-approved proposal must **open the line detail UI** (not the hard block).
2. In that open state when `clientApprovedTotalAt` (or equivalent lock):
   - **Allow:** notes, images (view/add), product / vendor link, room/label display, read-only cost/sell/qty.
   - **Block save of pricing fields** (qty, cost, markup, sell, shipping, amount) — keep existing pricing-change guards / duplicate-to-revise path for money changes.
3. Modal title / banner: e.g. “Client approved — money locked. Notes & images OK.” so it’s obvious why price fields are disabled.
4. Do **not** clear `clientApprovedTotalAt` as part of this fix. Do **not** re-price paid/ordered/invoiced lines (standing money rule).

## Acceptance
1. PRO-3047 (or any client-approved proposal): click line → detail opens (no “Cannot edit line” dead-end).
2. Can add/edit **notes**, open/add **images**, open **product link**.
3. Cannot change qty/cost/markup/sell without going through duplicate / clear-approval admin path (existing).
4. Invoiced-only lock path unchanged when every line is invoiced.

## Deploy
**Production bug** → Cursor #1 to **production** after Cindy GO. No staging lap. Mixed batches: keep this out of feature batches.
