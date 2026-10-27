# WO-264 DONE — Proposal creates one work order per item

Cindy Oct 1: create a work order for every item. Not lining. Not installation.

## Grounding

- Proposal Manage toolbar is `renderProposalDetail` in `platform/index.html` ~35623.
- Work orders live at `boards/{projectId}/workOrders`. The Builder opens a saved doc and fills defaults from `defaultData`.
- Work order numbers are `CLO-W-01` style (`nextWorkOrderNumber` in `platform/builder/index.html` ~3348).

## Change

- Manage and Edit show **Create work orders**.
- One draft per product line. Title decides the template (Roman, Roller, Drapery, and the other Builder templates).
- Lining, installation, labor, freight, and lines that already have a work order are skipped.
- The work order number is written on the line Tag. Prices, quantities, and the proposal total are not changed. `clientApprovedTotalAt` is not cleared.
- Design intent on the draft is the proposal line’s client description. Workroom Description is left blank.
- The Tag column is wide enough to show the number.

## Self-test

- Not clicked against a live proposal from this session. Staging deploy is the verify step.
