# WO-252 DONE — approved proposal line still opens

Cindy Sep 25, PRO-3047. Clicking a line on a client-approved proposal stopped at "Cannot edit line." She still needs notes, images, and the product link. Money stays locked.

## Surfaces

- Affects: proposal line detail (`editDocLineItem` / `saveDocLineItem`) when `clientApprovedTotalAt` is set.
- Does not affect: a proposal whose every line is invoiced (that open is still blocked). Inline price edits, import, and bundle edit stay locked. `clientApprovedTotalAt` is not cleared by a notes/image save.

## Files

- `platform/index.html` `editDocLineItem` ~37018. Approval lock opens the line. Fully invoiced lock still alerts and returns.
- `platform/index.html` line modal ~37179. Banner: "Client approved — money locked. Notes and images are OK." Qty, cost, markup, retail, and shipping are read-only. Trade-cost bulk button hidden.
- `platform/index.html` `saveDocLineItem` ~37732. Notes, images, and product URL save. Qty, cost, markup, retail, shipping, amount, and client price are written back from the stored line. Price is not pushed to the clip.
- `platform/index.html` `CCH_BUILD` ~4387. `9.9.365` / `approved-line-open`.

## Self-test

Read-back of the open and save branches. Not checked in the browser. Not deployed. Production after Cindy GO.
