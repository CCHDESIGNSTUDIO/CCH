# PROBLEM BRIEF FOR FABLE — Proposal rooms ≠ Room Boards (Cloud Rolling Hills)

**From:** Cursor (session with Cindy)  
**Date:** 2026-07-29  
**Project:** Cloud Rolling Hills (`cloud-rolling-hills`) · prod `cch-design-boards`  
**Example doc:** PRO-3037 (Azure / Neolith / stone slabs with rooms Guest 4, Guest 2, Kitchen, etc.)  
**Cindy’s words:** Images still in rooms after “clips fixed”; proposal room updates do **not** update Room Boards. Agents are not aligned — need one joint fix plan.

---

## What Cindy needs (product intent)

1. **Selections-only items** she cleared from rooms must **stay out** of Room Boards (no resurrection).
2. When she **changes Room on a proposal line**, that change must **show on Room Boards** (move / place the image in the right room — or clear it if room cleared).
3. She needs a **reliable** way to get unwanted images **out of rooms** without fighting the platform.

Right now #2 is broken in code. #1 was only partially healed by scripts. #3 works only via Room Board **Remove** / Selections room clear — not via proposal room dropdown.

---

## Grounded root causes (read these functions — do not trust summaries)

### A. Proposal room dropdown does **not** touch clips

`updateProposalItemRoom` (`platform/index.html` ~8638–8652):

- Writes `items[itemIdx].room` on the **proposal** document only.
- Calls `renderProposalDetail`.
- **Does not** call `cchEnsureClipsFromDocLines`.
- **Does not** call `cchPushDocLineRoomsToLinkedClips`.
- **Does not** update `boards/{projectId}/clips/{clipId}.room`.

So: proposal UI room ≠ Room Boards. This matches Cindy’s report exactly.

### B. Named “push rooms to clips” function does **not** push rooms

`cchPushDocLineRoomsToLinkedClips` (`index.html` ~12709–12749):

- Comment in code: *“Doc-linked clips are immutable — stamp linkage only; never push room/image/library from doc lines.”*
- Only patches linkage fields (`invoiceNum` / `proposalNum` / `poNum`, `_docLinkedAt`).
- **Never** sets `clip.room` from `line.room`.

Called from save/edit paths (~34470, ~38722) — still no room sync.

### C. WO-045 ensure (create/fill clips from doc lines) is **default OFF**

- Gate: `window._cchDocLineClipEnsureApply === true` (`cchDocLineClipEnsureWritesEnabled` ~13035–13038).
- Engine exists: `cchEnsureClipsFromDocLines` (~12779+).
- Production durable auto-on was **never** approved. Runtime apply stays OFF unless someone sets the flag in console for a session.

So even the “proposal → create/fill room clip” path is not live in normal use.

### D. What Cursor actually applied on prod data (narrow — not “all clips”)

| When | What | Scope |
|------|------|--------|
| 2026-07-28 | `heal-rh-keep-unroomed-PROD_BY_CURSOR_2026-07-28.js` | Stamp + `clipSuppressions` for items Cindy had cleared (~154 suppressions). Does **not** empty all rooms. |
| 2026-07-29 | `unassign-rh-orphan-houzz-lights-PROD_BY_CURSOR_2026-07-29.js --apply` | **27** orphan Houzz **Lighting** clips (not on any Studio proposal/invoice/PO) → Selections. **Kept roomed:** 31 lighting that match docs. **Skipped:** 58 non-lighting roomed Houzz. Report: `Docs/UNASSIGN_RH_ORPHAN_HOUZZ_LIGHTS_APPLY_BY_CURSOR_2026-07-29.json`. |

**Not done:** bulk remove of stone/slab/Azure/Neolith (or all roomed clips). Items on PRO-3037 with rooms were intentionally left / never in the orphan-lights pass.

### E. Unassign / stay-out path (works when used)

- Room Boards tile/list: **Remove** → `removeClipFromRoomBoard` (~77756) clears `clip.room`, stamps `_roomUnassignedFrom`, writes `clipSuppressions`.
- Selections room dropdown clear → `inlineUpdateClipField` room clear (~15133) same stamp/suppress.
- Fill-blank in `cchEnsureClipsFromDocLines` skips stamped/suppressed clips (~12907–12919).
- **Exception:** Selections room change is **blocked** if `cchClipIsLockedOnDoc` (~18867) — “on a proposal/invoice/PO — room cannot be changed from Selections.”

---

## Why Cindy feels “you fixed all the clips” but rooms are still wrong

1. Heals were **partial** (orphan lights + suppressions for prior clears) — not a full room purge.
2. Proposal **room** edits never drove Room Boards (A + B).
3. WO-045 ensure is OFF (C) — so proposal rooms don’t create/move clips either.
4. Cursor and Fable split WO-045 / WO-058 / data heals without a single **accepted product rule** for:  
   *“Is proposal room the source of truth for Room Boards, or is Selections/unassign?”*

---

## Immediate workaround for Cindy (today)

**To get an image out of a room (keeps Selections):**

1. Open project → **Room Boards**.
2. On the card → **Remove** (“Remove from room (keeps in Selections)”).
3. Confirm. Toast: removed from room — still in Selections.

**Or:** Selections → set Room to blank (only if clip is **not** doc-locked).

**Do not expect:** changing Room on PRO-3037 Edit Proposal to move or clear Room Board images — code does not do that today.

---

## Decision Fable must get from Cindy (before coding)

Pick **one** product rule:

| Option | Behavior |
|--------|----------|
| **P1 — Proposal room is canonical for Room Boards** | Changing proposal `line.room` moves/creates/clears the linked (or ensure-created) clip’s `room`. Unassign from board must still suppress resurrection (WO-058). Clear proposal room → unassign clip. |
| **P2 — Selections / Room Board Remove is canonical** | Proposal room is display/grouping only on the doc. Room Boards only change via Selections / Remove / Move. Then **remove or relabel** the proposal Room control so Cindy is not lied to. |
| **P3 — Hybrid** | Proposal room drives boards **only** when line has `clipId` / library link; otherwise Selections-only until explicit “Push rooms to boards.” |

Also decide RH data cleanup:

- **D1:** Bulk unassign all roomed clips that Cindy wants Selections-only (define allowlist: keep if on paid invoice? keep if lighting on PO?).
- **D2:** Only fix the live sync path; Cindy cleans rooms manually via Remove.

---

## Suggested Fable deliverables (after Cindy picks P1/P2/P3)

1. Work order with **file:line** constraints (no redesign of index.html architecture).
2. If P1: wire `updateProposalItemRoom` (and invoice equivalent if any) to a **single** sync helper that:  
   - updates linked clip room, or  
   - calls ensure+move under WO-058 suppressions, or  
   - unassigns when proposal room cleared.  
   **Must not** weaken doc isolation (no library price/image back-write).
3. Fix or rename `cchPushDocLineRoomsToLinkedClips` — name currently lies (does not push rooms).
4. Staging verify on a staging-native proposal (RH data may not exist on staging).
5. Prod data heal only on Cindy GO, with dry-run JSON first (`*_BY_CLAUDE_*` / `*_BY_FABLE_*` names).
6. Align with Cursor via this brief + ledger WO — **one executor**, one DONE note.

---

## Code touchpoints (aliases to grep)

- `updateProposalItemRoom`
- `cchPushDocLineRoomsToLinkedClips`
- `cchEnsureClipsFromDocLines`
- `_cchDocLineClipEnsureApply` / `cchDocLineClipEnsureWritesEnabled`
- `removeClipFromRoomBoard`
- `inlineUpdateClipField` (field === `'room'`)
- `clipSuppressions` / `_roomUnassignedFrom`
- `setSelectionItemRoom` / `cchClipIsLockedOnDoc`

## Related docs / scripts

- `Docs/HANDOFF_FABLE_proposal-to-rooms_CR_Jul24.md`
- `Docs/FABLE_DECISION_proposal-to-rooms_CW_Jul24_v1.0.md`
- `Docs/SESSION_LOG_Cursor_2026-07-28.md` (WO-058 heal)
- `_scripts/heal-rh-keep-unroomed-PROD_BY_CURSOR_2026-07-28.js`
- `_scripts/unassign-rh-orphan-houzz-lights-PROD_BY_CURSOR_2026-07-29.js`
- `Docs/UNASSIGN_RH_ORPHAN_HOUZZ_LIGHTS_APPLY_BY_CURSOR_2026-07-29.json`

---

## One-line problem statement (pasteable)

> On Cloud Rolling Hills, unwanted images remain on Room Boards because prior heals were partial (orphan Houzz lights only), and changing Room on a proposal line never updates `clips.room` — `updateProposalItemRoom` only patches the proposal, and `cchPushDocLineRoomsToLinkedClips` explicitly does not push rooms; WO-045 ensure writes stay OFF. Need Cindy’s product rule (proposal-canonical vs Selections-canonical) then one coordinated fix + optional RH cleanup GO.
