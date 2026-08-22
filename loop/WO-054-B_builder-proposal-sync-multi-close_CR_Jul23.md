# WO-054-B — Builder ↔ Proposal sync + multi-WO select + close-out
**Change ID:** FT-016 (pending #1 assign) · **State:** OPEN  
**Executor:** Cursor Raul (Builder) · **Verifier:** Claude  
**Requested:** Cindy · Jul 23, 2026 · after RH W1 PPT→WO staging success

## Problem (Cindy’s words)
1. Need an option to **update a proposal from a work order** when the WO changes.
2. Or on the **proposal**: select/add items / fabrics / trims / labor **from a work order**.
3. Must **select multiple work orders** for one proposal (not only “all” or current).
4. Must be able to **close out** work orders.

## What already exists (grounded — Builder)
| Capability | Where | Gap |
|------------|--------|-----|
| Create Proposal from **current** WO | `createProposalFromCurrentWorkOrder` · footer **Create Proposal** | One WO only |
| Proposal from **all** project WOs with costs | `createProposalFromAllProjectWorkOrders` · **Proposal — All WOs** | No multi-select picker; skips WOs without costs |
| Add fabrics/trims to **existing** proposal | `addWorkOrderFabricsToExistingProposal` · **Add fabrics to proposal** | Fabrics/trims only; **append** if missing — does **not** update/replace changed lines; no labor |
| Workroom labor/costs → new proposal | Import estimate / Create Proposal cost lines | Not “push updates” into existing proposal group |
| Close-out status | — | **Missing** — no `status: closed` (or similar) on `workOrders` |

Doc isolation still applies: proposal lines are snapshots once on the proposal; any “update from WO” must be an **explicit** user action (replace WO group / merge dialog), never silent back-sync.

## Desired behavior (locked for build)
### A. From Builder (work order)
1. **Update proposal from this WO** (new button near Add fabrics)
   - Pick linked proposal (or detect proposals that already contain this `workOrderId` / WO# group).
   - Dialog: replace material rows · replace workroom cost lines · or both · for **this WO’s group only**.
   - Never wipe unrelated proposal lines.
2. Keep **Add fabrics to proposal** as append-only; rename helper to clarify vs Update.

### B. Multi-WO → one proposal
1. **Proposal — Selected WOs…** (new) — checklist of project work orders (open by default; show closed optionally).
2. Build one draft proposal with one group per WO (existing `createProposalFromWorkOrderRecords` path).
3. Keep **Proposal — All WOs** as shortcut (all open WOs with costs).

### C. Close out
1. Field `status`: `open` | `closed` (default `open` for legacy docs).
2. UI: **Close work order** / **Reopen** on footer; list filters hide closed by default.
3. Closed WOs still openable read-mostly; block Create Proposal from closed unless confirm.

### D. Proposal-side (Studio) — Phase 2 if needed
“Add from work order” on proposal editor may need Studio touch. Prefer Builder-first (A+B+C). Flag if proposal UI is required in same FT.

## Constraints
- Staging first; production only on Cindy GO.
- Minimal diff; Builder `platform/builder/index.html` primary.
- Do not weaken document isolation.
- Reuse `buildProposalMaterialLinesFromWorkOrder`, `mergeWorkOrderMaterialsIntoProposalItems`, `createProposalFromWorkOrderRecords`.

## Acceptance
1. Change fabric YRD on a saved WO → **Update proposal** refreshes that WO’s material lines on PRO-####.
2. Multi-select 2+ WOs → one proposal with both groups.
3. Close WO → disappears from default open list; reopen works.
4. Labor/workroom lines included when user chooses “materials + costs” update path.

## Out of scope
- Auto-push on every Save (too dangerous).
- Full PPT image import pipeline (separate FT).
- Production deploy of this FT until staging verified.

## Related prod handoff (separate)
Cindy GO Jul 23: ship Builder **ft020–ft022** (already on staging) to production — see `_DEPLOY_QUEUE.md` production line from Raul.
