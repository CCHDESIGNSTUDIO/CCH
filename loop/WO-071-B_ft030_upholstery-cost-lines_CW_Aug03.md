# WO-071-B · FT-030 — Upholstery workroom cost lines · formalized #1 Aug 03
**Change ID:** FT-030 (`ft030`) · **Lane:** Builder (`WO-###-B`) · **Also ships with:** FT-029 (`ft029` Where it goes — same working copy)  
**State:** folded into full **WO-071-B package** (ft029–ft032) · DONE-UNVERIFIED · **#1 deploys**  
**Executor:** Cursor Raul (build) · **Deploy Master:** #1 · **Verifier:** Fable / Claude  

**File:** `platform/builder/index.html`  
**Ship rev:** `2026-08-03ft032-col-print-clean` (includes FT-030 + print polish)  
**Canonical package:** `loop/WO-071-B_DONE_CR_Aug03.md`

## Deploy policy note (Raul overstep)
Builder / Raul sessions **must not** `firebase deploy`. Staging for ft029/ft030 was already released per `_DEPLOY_QUEUE.md` (`#Raul … STATUS: done`). Going forward: queue only; **#1** deploys. Production still needs Cindy **GO**.

## What FT-030 does (grounded)
`workroomCostLinesForCategory("upholstery")` → `WORKROOM_COST_LINE_IDS_UPHOLSTERY` (`builder/index.html` ~1940–1952):

**Shown for upholstery**
1. Labor  
2. Nailhead cost  
3. Trim / banding  
4. Other expense  
5. Installation  
6. Shipping  

**Removed for upholstery** (stay on window treatments via `WORKROOM_COST_LINE_IDS_WT`)
- Panel / shade product  
- Hardware  
- Lining  

Classification: `nailheads` → Furniture & Upholstery product; `otherExpense` → expense (`WORKROOM_COST_CLASSIFICATION` ~1961+).

## Acceptance (binary — Fable)
1. Staging Builder → Upholstery WO → Ctrl+Shift+R → meta contains `ft030`.  
2. Workroom quote costs show the six upholstery rows above; **no** Panel / shade, Hardware, or Lining.  
3. Drapery / roman / roller WO still shows Panel / Hardware / Lining.  
4. Entering Nailhead / Other amounts updates subtotal; Create Proposal includes those cost lines only when filled.  
5. No WT regression; no library / clip price writes (cost lines are WO quote fields → proposal snapshot).

## Cindy smoke (her words)
> Ctrl+Shift+R on staging Builder → reopen the upholstery WO.

## Prod
Queue when Cindy types **GO WO-071-B** (or **GO FT-030**).

## Related docs
- Spec + ft029: `loop/WO-071-B_builder-upholstery-where-and-costs_CR_Aug03.md`  
- Raul DONE notes: `loop/WO-071-B_DONE_CR_Aug03.md`  
