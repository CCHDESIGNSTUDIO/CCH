# WO — Proposal page: Import line items from another proposal (same project)

**CC_Aug21_v1.0** · Author: **Claude Code** · Lane: **Cursor** (code) · File: `platform/index.html` · **Staging first; prod on Cindy GO.**
**Origin:** Vanessa feature request `New Features/PROPOSAL_IMPORT_FEATURE_REQUEST_C-Team_Aug21_v1.0.md`. Scope confirmed by Cindy Aug 21: **build the proposal→proposal import only** (vendor-PDF-on-proposal-page and one-click variant were considered and deferred).
**Grounded:** read Aug 21, 2026 against the live repo. Anchors verified this turn — see §Sources.

---

## 1. Goal (the real use case)
Present a client two option/variant proposals to compare (e.g. Doug's roller shades priced with **Lutron** vs **Somfy**) without rebuilding line by line. Both options share the same shade design; only the motorization line + price differ. Vanessa needs to pull the shared line items from an existing proposal into another proposal in the same project, leaving the source untouched.

## 2. Scope — build exactly this
Add an **"Import lines"** action on the Proposal page (edit view) that:
1. Opens a picker of **other proposals in the same project** (exclude the current one).
2. On selecting a source proposal, shows its line items as a **checkbox list** (default: all checked; groups selectable as a block).
3. **Appends** the selected line items into the **current** proposal's `items[]`. Source proposal is **read-only in this flow — never modified**.
4. Recomputes the current proposal total, saves, logs an activity entry, and re-renders.

**Out of scope (do not build here):** vendor-PDF import on the proposal page (already exists in Order Builder via `parseBartoloPdfLines` — separate WO if wanted); any work-order creation/linking; creating a brand-new proposal doc (that is `duplicateProposalAsCopy`, which already exists).

## 3. Grounding — what already exists (do NOT rebuild)
- **Duplicate already does items-only into a new Draft.** `duplicateProposalAsCopy` (`index.html:10625`) deep-clones `items[]` into a **new** proposal and carries **no work order** (payload @10634-10653 has no workOrder field). This WO is different: it imports **into an existing** proposal and lets the user **pick which lines**.
- **Work orders are a separate collection** — `boards/{projectId}/workOrders/{id}` (`index.html:17853`, `renderWorkOrdersTab` @17876). They are **not** embedded in a proposal, so importing line items inherently carries **no** work order. This resolves the request's open question: **import = line items only; attaching a work order stays a separate deliberate step** (nothing extra to code for it).
- **Proposal line-item model:** proposals at `boards/{projectId}/proposals/{id}`; line items in `items[]`. Grouping is via `groupId` + group-header rows — see `isProposalGroupHeaderItem`, `proposalDragBlockStart` (`index.html:10687`), `proposalDragBlockLength` (`index.html:10700`).
- **Append pattern to reuse:** `addProposalLineItem(projectId, proposalId)` (`index.html:37020`) is the existing single-line add — mirror its write/re-render/total-recompute path. Deep-clone pattern: `JSON.parse(JSON.stringify(d.items||[]))` (`index.html:10631`).

## 4. Implementation notes
**A. Entry point.** Add an "Import lines" button in the proposal edit toolbar, alongside Add line / Duplicate. Gate to staff (same auth as other edit actions).

**B. Source picker.** Query `boards/{projectId}/proposals`, list `proposalNum`/`name` + status + line count + total, newest first; exclude `proposalId` of the open doc. Reuse the app's existing modal/list styling.

**C. Line selection.** Render source `items[]` as checkboxes. Preserve group integrity: if any member of a `groupId` block is checked, treat the group header + all members as a unit (reuse `proposalDragBlockStart`/`proposalDragBlockLength` logic to compute block boundaries).

**D. Append (the careful part).**
- Deep-clone selected items (`JSON.parse(JSON.stringify(...))`).
- **Re-key ids:** assign each imported item a fresh unique `id` so it can't collide with an existing row.
- **Namespace groupId:** remap each imported `groupId` to a new unique value (keep a source→new map so a multi-row group stays intact) — prevents a merged group colliding with an existing group in the target.
- **Do not** carry the source proposal's doc-level fields (number, client, tags, attachments) — line items only.
- Respect existing line-item rules: honor `_imageLocked` (never overwrite), and this is an **explicit user APPLY action** (allowed to write), not an auto-sync — consistent with the RESOLVE/APPLY rule in the platform skill.
- Recompute `total` from the merged `items[]` the same way the proposal editor does elsewhere; set `updatedAt`; append an `activityLog` entry: `imported N line(s) from <sourceProposalNum>`.

**E. Feedback.** Toast "Imported N lines from PRO-xxxx"; re-render the proposal edit view; invalidate any search cache if the editor does so elsewhere.

## 5. Acceptance (binary)
1. On a proposal edit view, **Import lines** lists the project's other proposals (current one excluded) with number, status, line count, total.
2. Selecting a source shows its lines as checkboxes (all checked by default); a grouped block checks/unchecks as a unit.
3. Importing appends the selected lines to the current proposal; **total updates correctly**; imported grouped rows keep their grouping and do not merge into or collide with existing groups.
4. The **source proposal is unchanged** (line count/total/items identical before and after).
5. No work order is created, linked, or copied by the import.
6. Re-opening the target proposal shows the imported lines persisted; activity log records the import.
7. Verified on staging; prod only on Cindy's typed GO.

## 6. Compare-two-quotes workflow this enables
1. Keep the base shade proposal + its (separate) work order untouched.
2. Open/create **Option A** (Lutron) → Import lines from base → swap the motorization line + price.
3. Open/create **Option B** (Somfy) → Import lines from base → swap that line.
4. Both options presented to the client to compare; base + work order never disturbed.

## 7. Sources / grounding
`platform/index.html`: `duplicateProposalAsCopy` @10625 (payload @10634-10653), `duplicateProposalLineItem` @10327, group helpers `proposalDragBlockStart` @10687 / `proposalDragBlockLength` @10700, work-order collection + tab `boards/{proj}/workOrders` @17853 / `renderWorkOrdersTab` @17876, `addProposalLineItem` @37020, deep-clone pattern @10631. Order Builder existing PDF import (out of scope, reference only): `platform/builder/index.html:894` + `parseBartoloPdfLines` @2824. Request: `New Features/PROPOSAL_IMPORT_FEATURE_REQUEST_C-Team_Aug21_v1.0.md`.

*CC_Aug21_v1.0 — Claude Code work order. Read-only grounding; no code changed. Staging first; prod on Cindy GO. Scope = proposal→proposal line-item import only.*
