# WO-113 — Proposal ↔ Selections ↔ Room Boards: one visible product list

**CW_Aug13** · Lane: **Cursor / Code** · **File:** `platform/index.html` (primary) · **Staging first; prod on Cindy GO.**

**Supersedes / completes gaps left by:** WO-045 (clip ensure), WO-056 (duplicate-not-move), WO-058 (suppressions), WO-092 Part 2/3 (library dedupe). Does **not** replace document isolation or saved-proposal pricing rules.

---

## What Cindy reported (Aug 13, Cloud - Rolling Hills, PRO-3035)

- Items on **PRO-3035** (e.g. Arcilla, villa classica) show on the proposal but **missing from Selections**.
- Same items **not on Room Boards** in the expected rooms.
- After adding a picture, items **seemed to vanish** from Selections (image on Room Board / proposal still present).
- **Add item** rail searching "arcilla" finds 4 project rows + library twins; **Selections tab** can show **0** (search/filter/dedup) even when data exists.
- Recurring pain: *"We've been through this 100 times"* — proposal, Selections, and Room Boards must stay aligned.

**Canonical test project:** `cloud-rolling-hills` · **Canonical proposal:** PRO-3035 (`boards/cloud-rolling-hills/proposals/PPJ3cJ99AjQ8okpQI7Nv`).

---

## Business rule (locked for this WO)

> **Every product line on a board-scoped proposal or invoice with a room must appear in Selections and on the matching Room Board clip** (product + room). Proposal page, Selections tab, and Room Boards must not contradict each other after one refresh.

Exceptions (unchanged):

- Labor, expense, freight, design-fee, header/group lines — not room-board products.
- Lines with **no room** — stay in Selections as unassigned; do not spawn a room-board tile until room is set.
- Document isolation: **never** push proposal prices/cost back to library or mutate saved proposal lines from clip edits (standing rule Jul 31).

---

## Root causes (grounded Aug 13, `platform/index.html`)

### A. Board-scoped proposal lines never become Selections rows

`renderSelectionsTab` @17927 loads top-level `proposals` and **pushes** line items into `items[]` (@18167–18187).

Board-scoped `boards/{projectId}/proposals` (@18189–18200) only call `_addProposalLinkForItem` — **no `items.push`**. PRO-3035 lives here. If the clip is missing or filtered out, the line **does not exist** on the Selections tab at all.

### B. WO-045 clip ensure is not durable

`cchEnsureClipsFromDocLines` @13060 exists; writes gated by `window._cchDocLineClipEnsureApply === true` @13332 (default **OFF**). One-time RH prod backfill (Jul 27) does not keep new/edited lines in sync.

### C. Two different "Selections" loaders

| Surface | Function | Behavior |
|---------|----------|----------|
| Selections tab | `renderSelectionsTab` @17927 | Clips + library + legacy docs → heavy dedup (@18285+) → `cchClipShouldHideFromProductViews` (@18262) → filters → **50/page pagination** |
| Add item rail | `_loadProjectSelectionSidebarItems` @41368 | Clips + library direct → simpler dedup → no pagination |

Same project can show **4 rows** in Add item and **0** on Selections tab.

### D. Misleading empty state

Header shows `${sortedFiltered.length} selections` (@18690) — **filtered** count only. Search typo ("Arcadia" vs "Arcilla") → "0 selections" with no "filtered from N total" hint.

### E. Library twins (WO-092)

Duplicate library rows + Selections dedup by `selDupKeyForItem` @17746 can collapse/hide rows. Related but separate cleanup track.

---

## Scope — three deliverables (all required)

### Part 1 — Selections tab: ingest board-scoped proposal + invoice lines

In `renderSelectionsTab`, when iterating `propSnap2` (board proposals) and board invoice subcollection, **push product lines into `items[]`** the same way legacy proposals do (@18176–18185), with:

- `source: 'proposal'` or `'invoice'`
- `title`, `vendor`, `room`, `category`, `cost`, `sell`, `sku`, doc refs
- `clipId` / `sourceClipId` from line when present (for edit actions)
- Skip non-product lines (`isRealProduct`, expense types, headers)

Dedup merge (@18285+) must prefer **boardclip** over proposal row when same `selDupKeyForItem`, but **proposal row must survive** when no clip exists (this is the fallback Cindy expects).

### Part 2 — Durable clip ensure on doc save (complete WO-045)

On `saveDocLineItem` / `docEditSave` for proposals and invoices (board-scoped paths included):

- Call `cchEnsureClipsFromDocLines` with writes **ON by default** for staging (config flag ok; default must not be session-only OFF).
- Ensure: line with room → clip at `(product, room)`; fill blank-room orphan; link `clipId` on line.
- Respect WO-058 suppressions and `_roomUnassignedFrom` — do not resurrect user-removed clips.
- **Do not** change prices on saved/locked docs per `cch-cost-lock.js`.

Optional admin dry-run: `cchDryRunDocLineClipSync(projectId)` before prod enable.

### Part 3 — Unify Selections tab visibility with Add-item picker

Minimum:

1. Apply the **same** product visibility predicate to both paths (`_disSidebarItemIsProjectSelectionProduct` @41336 already mirrors `isRealProduct`; add `cchClipShouldHideFromProductViews` to **both** or **neither** — pick one rule, document it).
2. Selections header: show **`filteredCount of totalCount`** when search/filters active (e.g. `3 of 412 selections`).
3. **Clear Filters** must reset search box visually and in `window._selFilter.search`.

Stretch (same WO if small): extract shared loader `_loadProjectSelectionRows(projectId)` used by tab + sidebar to stop drift.

---

## Out of scope

- WO-092 data cleanup script (library duplicate deletion) — separate pass after Part 1 verify.
- Reverse sync clip → proposal line (still isolated).
- Houzz-import legacy rows.
- Prod Firestore backfill without Cindy GO and dry-run manifest.

---

## Guardrails

- `cch-doc-isolation.js` / standing rule: no silent library price writes from doc heal.
- WO-058: `clipSuppressions` + `_roomUnassignedFrom` honored on ensure.
- Staging project for verify: `cloud-rolling-hills` (prod mirror ok read-only for audit).
- No split of `index.html`.

---

## Acceptance (binary — verify on staging)

Use **PRO-3035** and at least one line added **after** deploy.

1. **Arcilla** (and villa classica): visible on **Selections tab** with empty search and Clear Filters; count > 0 for project total.
2. Same lines visible on **Room Boards** in correct room (MBR & Bath / Kitchen) OR clearly unassigned in Selections if room blank.
3. **Add item** rail and **Selections tab** show the same project products for search "arcilla" (± spelling tolerance optional, not required).
4. New line added to PRO-3035 with room **Kitchen** → after save + refresh: appears on Selections, Room Board Kitchen, without manual clip create.
5. Remove from room board (unassign, not delete) → stays in Selections; does not re-spawn on room board until re-roomed (WO-058 behavior preserved).
6. Locked/sent/paid invoice: ensure path does not mutate billed lines.
7. Header shows filtered vs total when search active.

---

## Verify steps (for reviewer / Fable)

1. Staging hard refresh → orange STAGING banner.
2. Open `#/project/cloud-rolling-hills/selections` — note total count (no search).
3. Search `Arcilla` — rows appear; header shows `N of M` if implemented.
4. Open PRO-3035 Client View — confirm Arcilla lines still present (no regression).
5. Open Room Boards → Kitchen / MBR & Bath — clips for proposal products visible.
6. Console: no flood of clip ensure errors; optional dry-run on copy project before prod.

---

## Grounding checklist (executor must read before coding)

- [ ] `renderSelectionsTab` @17927 — board proposal gap @18189–18200
- [ ] `cchEnsureClipsFromDocLines` @13060 — write gate @13332
- [ ] `_loadProjectSelectionSidebarItems` @41368 — picker parity
- [ ] `selDupKeyForItem` @17746 — dedup keys
- [ ] `saveDocLineItem` / `docEditSave` — ensure call sites
- [ ] `loop/WO-045_*`, `loop/verify/WO-045/`, `loop/verify/WO-058/`

---

## Deploy

- **Target:** staging hosting (`platform/index.html` only unless flag extracted).
- Queue via `_DEPLOY_QUEUE.md` — do not commit/deploy from non-#1 sessions.
- Prod: Cindy typed GO only.

---

## Implementation status (Cursor Aug 13 PM)

**Part 1 + header UX — coded, not deployed:** `platform/index.html` build **9.9.168** (`wo113a-board-proposal-selections`). Board-scoped proposal lines now `items.push` in `renderSelectionsTab`. Parts 2–3 still open. Handoff: `Docs/HANDOFF_WO-113_Proposal_Selections_RoomBoards_CW_Aug13_v1.0.md`.

*Draft WO-113 · CW Aug 13 2026 · For double-check before implementation.*
