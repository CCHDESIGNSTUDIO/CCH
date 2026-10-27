# WO-266 DONE — Bartolo budget import creates work orders with the description and the cost

Cindy Oct 2, staging Order Builder. Same dialog: "This PDF layout was not auto-detected."

## Grounding

`platform/builder/index.html` `detectBartoloFormat` and `importBartoloEstimatePdf`.

The builder reads the PDF with pdf.js. That reader splits the estimate number into `2026 - 00617`. The detector required `2026-00617` with no spaces, so the Cloud Rolling Hills budget came back unknown and the QuickBooks question appeared. No work orders were written.

Checked with pdf.js 3.11 (the same library the builder loads) against `CCH.Cloud.Rolling.Hills.Budget.Proposal.2026.pdf`.

## Change

- Join a hyphen that pdf.js splits (`2026 - 00617`, and word hyphens such as wall-mounted).
- Do not stop on the "not auto-detected" question. Parse, and only alert if nothing comes out.
- After she confirms, save one work order per room. Design intent is the treatment scope. Panel / shade product cost is the pre-tax room amount. Lining and installation are not their own work orders. The draft proposal is still created, and the work order number is on the Tag.
- Builder rev `2026-10-02wo-from-budget`.

pdf.js extract of that budget: 19 rooms, $116,638. Butler Pantry cost $3,684, description starts "One natural-grass Hartmann & Forbes woven shade…".

## Not changed

Print CSS, proposal money math, Cloud Functions. Production builder is unchanged.
