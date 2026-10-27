# WO-262 DONE — Workroom Description on the work order

Cindy Oct 1: the client description and the Bartolo fabrication spec are two different texts.

## Grounding

- Design intent is the client text. It prints under “Design Intent” (`platform/builder/index.html` ~9735) and is what Create Proposal copies onto proposal lines (`workroomCostProposalLine` ~10269).
- Bulleted notes are `d.notes` / `d.fabNotes`. Per-material text is `materialDescription` (~1998). Neither is the fabrication paragraph.

## Change

- New optional string `workroomDescription` on every work-order template (`defaultData`).
- Edit box under Design intent. Saves with the work order and the local draft.
- Tear sheet prints a “Workroom Description” block only when the box has text.
- Design intent, notes, material description, numbering, and proposal line copy are unchanged.

## Self-test

- Inline scripts in `platform/builder/index.html` passed `node --check`.
- Empty field adds no tear-sheet block.

## Deploy

Staging hosting. Production only on Cindy’s GO.
