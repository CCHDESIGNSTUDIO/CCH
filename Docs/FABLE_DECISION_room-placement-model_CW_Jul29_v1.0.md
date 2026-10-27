# FABLE DECISION — Room placement model · CW Jul 29 v1.0

**Canon one-liner:** One tile per item per room · your removal wins · item always safe in Library and Selections.

**Cindy locked P1 (Jul 30):** Proposal room change drives Room Board placement.

## Product rules

1. **Placement identity** = item + room (libraryProductId preferred; else title+vendor).
2. **One tile** per item+room. Dedupe **both** creation paths (manual placement + doc line) onto the same tile — never a second.
3. **Pre-proposal path:** Item can be placed in a room for client approve/decline before any proposal. A later proposal for that item+room **links** to the existing tile (no duplicate).
4. **Proposal / invoice room change** moves/creates/clears the linked placement (`updateProposalItemRoom` → sync helper). Honors suppressions / `_roomUnassignedFrom` for resurrection; explicit place clears suppression (like Move). **Board Remove still wins** (writes suppression + stamp).
5. **Doc delete / re-room cascade** releases the placement only when the **last** doc claim releases **and** no manual placement holds it.
6. **No library price/image back-write** (document isolation).
7. **Durable WO-045 ensure** for new lines: ON only after staging proof (not this first ship).
8. **RH cleanup:** dry-run first (dedupe tiles, reconcile roomed products, clear orphan-blank junk). Prod writes only on Cindy typed GO. RH only.

## Build notes (Cursor Jul 30)

- Helper: `cchSyncDocLineRoomToPlacement` + `cchReleasePlacementIfOrphaned` + `_disResolveClipIdForProductRoom`.
- Wired: `updateProposalItemRoom`, proposal line remove, doc-edit room change / remove.
- Manual creates stamp `_manualPlacement: true`.
- Staging first; durable ensure stays OFF.
