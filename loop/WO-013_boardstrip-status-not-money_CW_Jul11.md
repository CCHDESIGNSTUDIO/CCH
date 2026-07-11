# WO-013 · Room Board header strip: show pipeline status, not Cost/Sell/Margin · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## What Cindy said (Jul 11, viewing Rolling Hills Room Boards)
"I don't know what these financial numbers are, they seem pointless on these pages. It would be better to
show what's been approved, pending, invoiced and declined."

She means the grey "BUDGET summary bar" at the top of the Room Boards page — currently **Cost · Sell ·
Margin · Rooms · Categories**. The Cost/Sell/Margin trio is noise on a board (and it's owner-only leakage
Vanessa shouldn't see per the standing permission rule). Replace the money with the product **pipeline**.

## Grounded location (verified in index.html this session)
- The strip: **index.html:20684–20692** — `<!-- BUDGET summary bar -->`, gated on `grandSell > 0`, five
  cells (Cost 20687 / Sell 20688 / Margin 20689 / Rooms 20690 / Categories 20691). This is the ONLY
  Cost/Sell/Margin/Rooms/Categories strip in the file (single grep hit) — scope is just this block.
- Clip status is already a real field:
  - `getClipApprovalStatus(clip)` (**index.html:20020**) returns `'approved' | 'declined' | 'pending'`
    from `clip.clientSelectionStatus || clip.lineApprovalStatus`.
  - Invoiced = clip carries an invoice link: `clip.invoiceId || clip.invoiceNum || clip.houzzInvoice`
    (the "INV" pill logic, **index.html:20101 / 20109**).
- The item list on this page is `clips` (count already shown as "Displaying N products", :20662).

## Change
Replace the three money cells (Cost, Sell, Margin) with **four status count cells**; keep Rooms and
Categories (non-financial, useful). New strip order: **Pending · Approved · Invoiced · Declined · Rooms ·
Categories**. Do not change the strip's styling family (same `#F0F4F9` bar, same label/value type scale) —
only the cells.

**Counts (mutually exclusive funnel, computed over `clips`) — default semantics:**
1. **Invoiced** first: `clip.invoiceId || clip.invoiceNum || clip.houzzInvoice` present → count Invoiced
   (regardless of approval — an invoiced item has progressed furthest).
2. Else by `getClipApprovalStatus(clip)`: `'approved'` → Approved, `'declined'` → Declined, else Pending.
So Pending + Approved + Invoiced + Declined = total items (no double-count). Color cues (reuse existing
badge palette): Pending gold `#8A6A2D`, Approved green `#2E7D4F`, Invoiced navy/gold, Declined red `#B84545`.

> Flag for Cindy: default treats Invoiced as its own bucket (pulled out of Approved). If she'd rather
> Invoiced be a subset shown alongside a full Approved count, that's a one-line change — confirm on review.

## Flow back to FFE — keep the two consistent (grounded this session)
The FFE Tracker reads the SAME clips (`ffeFilterProductClipsOnly(clips)`, product-only) and the same
`clientSelectionStatus`, and has its own Invoiced report (`ffeCollectInvoicedLineRows` :26795,
`renderFFEInvoicedItemsReport` :26879). So this strip is a mini-readout of the FFE pipeline — good.
Caveat: FFE's `cchFfeEffectiveSelectionStatus(clip)` (:26974) returns `Declined` / `Proposed` /
`selectionStatus||approvalStatus`, whereas the board's `getClipApprovalStatus` returns `approved/declined/
pending`. Same data, different labels. **Reconcile so the board strip and FFE never disagree for one item:**
derive the strip's Approved/Pending/Declined from the same fields the FFE helper uses (treat FFE `Proposed`
as the strip's `Pending`), and count Invoiced by the same invoice-linkage signal the FFE Invoiced report
uses. If aligning the helpers is too invasive this pass, at minimum ensure the Pending/Proposed default and
the declined test match, and leave a `// keep in sync with cchFfeEffectiveSelectionStatus` comment.

## Constraints
- Gate: keep it rendering whenever there are clips (drop the `grandSell > 0` gate, which hid the strip when
  sell was 0 — counts are still meaningful at $0). Or gate on `clips.length > 0`.
- Do NOT surface Cost/Sell/Margin here for anyone (removes the Vanessa leakage on this page too).
- Navy/gold, no gray boxes beyond the existing bar; never split index.html; `node --check` + tail after edit.
- Reuse `getClipApprovalStatus`; do not invent a new status model.

## Acceptance (binary)
1. Room Boards top strip shows Pending / Approved / Invoiced / Declined / Rooms / Categories — no Cost, Sell,
   or Margin anywhere on the page.
2. Counts are correct on Rolling Hills: sum of the four status counts = the "Displaying N products" count.
3. An item with an INV link counts as Invoiced; a Pending item counts Pending; a Declined item Declined.
4. Strip still renders when project sell total is 0.
5. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
Rolling Hills + Holtz Hill Room Boards: screenshot the new strip; confirm the four counts sum to the product
count and match spot-checked card badges. loop/verify/WO-013/.

## DONE note
loop/WO-013_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
