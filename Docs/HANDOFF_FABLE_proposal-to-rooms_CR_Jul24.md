# Fable noodle brief — Proposal lines → Room Boards (not “more Selections clips”)

**From:** Cursor (Machine 1) · **Date:** 2026-07-24  
**Project:** Cloud Rolling Hills (`cloud-rolling-hills`) · **Prod:** cch-platform.web.app  
**Cindy ask (exact intent):** *I don’t need 5 clips in Selections — I just need them to show up in the rooms.*  
Hand this to Fable to design/sequence. Do **not** implement until Cindy picks a path.

---

## 1. What Cindy actually wants

| Want | Don’t want |
|------|------------|
| Items that are on a **proposal with a room** appear on that **Room Board** | A Selections list bloated with one row per (product × room) just to make boards work |
| Rooms on the proposal are the source of truth for “where this lives” | Manual re-entry of the same Ann Sacks / Walker Zanger / tile lines into Selections |
| Same product in Guest 5 + Kitchen can live on **both boards** | Forcing her to think in “clip inventory” when she’s thinking in “proposal → rooms” |

Selections can stay a **working list / pricing list**. Room Boards are the **spatial** view. Today those are the same `boards/{projectId}/clips` docs — that’s the architecture tension Fable must resolve or reframe.

---

## 2. What we proved today (prod RH — grounded)

### Ann Sacks (screenshot: Library 3, Selections Ann Sacks filter = 1)

Firestore has **3 clips**, all `vendor: "Ann Sacks"`, `source: clipper`:

| Product | Clip id | Clip.room | PRO-3035 room |
|---------|---------|-----------|---------------|
| Savoy Penny Mosaic | `qqDWArQpo4dJCMW4A0S3` | MBR & Bath | MBR & Bath |
| Arcilla 3" x 12" Field Tile | `H2gUishcDQieT0NkgP6v` | *(blank)* | MBR & Bath |
| Arcilla 1" x 15" Bullnose Trim | `QYUIgFt7DxUw2KlxOzNo` | *(blank)* | MBR & Bath |

So: **not “missing from Firestore.”** Two problems stack:

1. **Room not on the clip** → cannot appear on MBR & Bath Room Board (board views key off `clip.room`).
2. **Selections hide bug** → titles with `N" x N"` are treated as spec junk:

```text
cchClipTitleLooksLikeSpecFragment @ platform/index.html ~12549
  /\d+…["]?\s*[x×]\s*\d+/  && length < 55  → hide
```

Tested:

| Title | HIDE? |
|-------|-------|
| Arcilla 3" x 12" Field Tile | **true** |
| Arcilla 1" x 15" Bullnose Trim | **true** |
| Savoy Penny Mosaic | false |
| Gleam Ivory 12"x24" | **true** (Guest 5 symptom too) |

Selections loads clips as `source: 'boardclip'` (`renderSelectionsTab` ~17298), so they **lose** the Room Board clipper exemption at ~22495 (`if src===clipper return true`). Same hide also hits FFE filter ~29405.

### Why proposal room didn’t fill the clip

- `cchPushDocLineRoomsToLinkedClips` (~12620–12643) **refuses** to push room — “doc-linked clips are immutable, stamp linkage only.”
- Reverse sync **WO-045** (`cchEnsureClipsFromDocLines` ~12690+, gate `_cchDocLineClipEnsureApply` ~12944) creates/fills clips from roomed doc lines.
- Staging: WO-045 **verified** (see `loop/verify/WO-045/VERIFY_CR_Jul23.md`).
- **Prod apply still gated** — needs Cindy typed GO (`cchApplyDocLineClipSync('cloud-rolling-hills')`).
- Durable default-on for new saves is still **session flag only** — separate follow-on.

Related shipped/gated chain: WO-055 (re-add same product), WO-056 (Add-to-room = duplicate clip), WO-058/058b (unassign ≠ delete; fill-blank respects `_roomUnassignedFrom` + `clipSuppressions`). Prod hosting **v9.8.108** + rules already live (WO-059).

---

## 3. Architecture tension (the noodle)

**Current locked model (WO-045/055/056):**  
identity = **product + room** → separate clip IDs per room.  
That *does* put items on multiple Room Boards. Side effect Cindy is rejecting: **Selections grows** (one row per roomed clip).

**Cindy’s mental model:**  
Proposal line (with room) → show on that room’s board. Selections ≠ “one card per board placement.”

Fable should pick or hybridize — do **not** silently invent a fourth document type.

### Option A — Keep clip-per-room; change Selections UX (smallest product change)

- Keep WO-045 model (boards need a roomed clip).
- Selections UI: collapse by `libraryProductId` (or title+vendor), show **room chips / “on N rooms”** like multi-doc badges already do for proposals.
- Underlying clips stay N; list shows ~1 row.
- **Pros:** Room Boards keep working; WO-045 apply path stays valid.  
- **Cons:** Still N Firestore clips; sync/unassign rules stay complex.

### Option B — Room Board reads proposal lines (bigger, isolation-sensitive)

- Room Board render = union of (roomed clips) **+** proposal/invoice lines with that room (read-only overlay or materialize on view).
- Selections stays lean; no mass clip create.
- **Pros:** Matches “I just need them on the rooms.”  
- **Cons:** Crosses document-isolation instincts; edit/delete/unassign semantics get hard; must not write proposal fields back into library; client portal / print paths must be checked.

### Option C — One Selections clip; room membership elsewhere

- Single clip per product; `rooms: []` or join table / board membership docs.
- **Pros:** Selections count stays 1.  
- **Cons:** Large schema + Room Board + suppressions + Houzz import rewrite; conflicts with product+room identity already verified on staging.

### Option D — Narrow “fix now” only (no model change)

1. Fix dimension-title false positive so named tiles aren’t hidden.  
2. Cindy GO → WO-045 **prod dry-run then apply** on RH only (fill blank rooms / create missing roomed clips).  
3. Defer Selections collapse UX.

**Pros:** Unblocks MBR & Bath / Guest 5 boards this week.  
**Cons:** Does **not** address “I don’t want 5 clips in Selections” — may make Selections busier until Option A.

**Recommendation to Fable:** Sequence **D (unblock)** then **A (Selections collapse)** unless Cindy explicitly wants B/C. Do not turn on WO-045 writes project-wide without RH pilot review.

---

## 4. Constraints Fable must respect

- Repo: `C:\dev\CCH-Platform-Deploy\cch-deploy` only (not Dropbox code).
- Code grounding: grep ≥3 aliases, read bodies, cite file:line — `CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md`.
- Doc isolation: proposal/invoice/PO lines are snapshots — no silent library back-sync (`cch-doc-isolation.js` / `document-isolation.mdc`).
- Staging ≠ prod Firestore.
- No commit/push/deploy except Deploy Master #1; queue `_DEPLOY_QUEUE.md`.
- Production data writes (WO-045 apply) only on Cindy **GO**.
- Surgical diffs; don’t refactor Selections wholesale while noodling.

---

## 5. Suggested Fable deliverable

1. **One-pager decision:** A / B / C / D(+A) with tradeoffs in Cindy language (rooms vs Selections count).  
2. If D+A:  
   - Exact patch plan for `cchClipTitleLooksLikeSpecFragment` (keep real junk scrap hidden).  
   - Confirm Room Board path (~22491) vs Selections (~17496) after fix.  
   - Prod dry-run checklist for `cchDryRunDocLineClipSync('cloud-rolling-hills')` before apply.  
   - Selections collapse sketch (chips, not 5 rows) — no code until Cindy says go.  
3. Explicit **out of scope:** WO-045 durable default-on WO; multi-project roll; changing proposal numbering; QB.

---

## 6. Verify anchors (after a chosen path)

- Library Ann Sacks = 3 → Room Board **MBR & Bath** shows Savoy + both Arcillas (not only Savoy).  
- Proposal Guest 5 lines (e.g. Gleam Ivory 12"x24") visible on **Guest 5** board.  
- Selections Ann Sacks filter: Cindy-acceptable row count (collapsed or honest), not “1 of 3 hidden by junk filter.”  
- Unassign from board still does **not** resurrect (WO-058b).  
- Hard refresh prod/staging; build tag noted in handoff.

---

## 7. Key code pointers

| Topic | Where |
|-------|--------|
| Spec-fragment / dimension hide | `platform/index.html` `cchClipTitleLooksLikeSpecFragment` ~12536; `cchClipShouldHideFromProductViews` ~12593 |
| Selections load + hide | `renderSelectionsTab` ~17161; filter ~17484–17506 |
| Room Board clip filter (clipper exempt) | ~22491–22505 |
| Doc→clip ensure (WO-045) | `cchEnsureClipsFromDocLines` ~12690; writes gate ~12944; dry-run/apply ~13027–13091 |
| Room push refused | `cchPushDocLineRoomsToLinkedClips` ~12620 |
| Ledger / verify | `loop/LOOP_LEDGER.md`; `loop/verify/WO-045/`; `loop/verify/WO-058/`; `loop/verify/WO-059/` |

---

**STATUS:** Brief only — no code, no prod apply, waiting on Fable + Cindy path pick.
