<!-- CODE-MS5 — Neptune (Claude Code), Computer 5 — Oct 1, 2026 -->
# WO (PROPOSED — #1 assign number) — Proposals + Invoices Manage: Sort & group by Room OR Category (persisted, collapsible)

**Neptune_Oct01_v1.0** · Lane: **Cursor #1** (code) · File: `platform/index.html` · **FEATURE → staging-first** (NOT the prod-bug skip-staging lane). · Verify: Neptune (Cloud Code).
**Origin:** Cynthia, Oct 1 2026 — building a very large proposal; editing is painful because same-room lines are scattered and she hand-drags items up/down. Wants to sort by room (default) or by category, saved so it stays, with collapse so she isn't scrolling 500 lines. Manage/edit view only — NOT client view.
**Grounded (read this turn, live repo `C:\dev\CCH-Platform-Deploy\cch-deploy`):** anchors in §Sources.

---

## 1. What exists already (reuse, don't rebuild)
- **Reorder+save path:** editor saves line order via `docRef.update({ items: … , updatedAt })` — `index.html:9792` (and the same pattern at 9105/9195/10324/10587/10770). Drag-reorder already does exactly this. "Sort" just arranges the array before the same save.
- **Project room order source:** board `rooms` array + `roomMeta` collection — `index.html:10300-10307` (same source "Set room for all lines" uses via `dbPickRoom` @10311).
- **Category options source:** `docEditBuildCategoryOptions(selected, boardCategories, boardRooms)` @9738; master category order in `platform/cch-product-categories.js`.
- **Collapse mechanism (Manage):** `toggleProposalGroupCollapse` @9776 (`window._proposalCollapsedGroups`, key `projectId|proposalId|groupId`) and `toggleInvoiceGroupCollapse` @11443. Reuse the same mechanism keyed by block label.
- **Group-header model:** `isProposalGroupHeaderItem` @9381; block helpers `proposalDragBlockStart`/`Length` @10687/10700.

## 2. Scope
Add a **"Sort by ▾"** picker to the Manage line-item toolbar on **proposals AND invoices** (next to "Create group from selected rows"):
- **By Room** (default) · **By Category**
- Remembers the last-used mode **per document** (sessionStorage key per projectId|docId, same style as the Timely collapse persistence @17491).

**On apply, it:**
1. Reorders `items[]` so all lines sharing the chosen key (`room` or `category`) are **contiguous**.
2. Block order: **Room mode** = the project's room list (board.rooms + roomMeta); **Category mode** = the master category order (`cch-product-categories.js`); fallback **alphabetical** for anything not in those lists.
3. Lines with no room/category, plus discount / design-fee / non-product lines, go to an **"Other"** block at the **end** — never dropped.
4. **Saves** the new order via the existing `docRef.update({ items, updatedAt })` path → it **stays sorted**.
5. Renders a **collapsible header per block** (room or category name · line count · block subtotal · chevron), plus **Collapse all / Expand all**. Collapsed state keyed by block label, persisted per doc.

## 3. MONEY / LOCK SAFETY (hard constraints — verifier will FAIL the WO on any violation)
- **Reorder ONLY.** Never change any line's amount, qty, markup, status, notes, images, product link, or id. Count-in == count-out; no drop / merge / duplicate.
- **Never recompute or change `total`.** Order does not affect it; it must stay identical to the penny. (May pass `total` through unchanged, but must not re-derive a different value.)
- **Never clear `clientApprovedTotalAt`.** Other edit actions delete it (`index.html:10368` `FieldValue.delete()`) — this one MUST NOT. A reorder is not a money change, so an approved / sent / signed proposal stays approved and locked. (WO-252 money-lock rule.)
- **Preserve existing manual groups** ("Create group from selected rows" blocks) as intact units — do not split a manual group across rooms/categories. If manual groups are present, keep each block together and sort the blocks; do not orphan a group header from its children (use `proposalDragBlockStart/Length` @10687/10700).
- Display-side headers in Manage are view furniture — do **not** inject new group-header items into `items[]` for the collapse headers (keep line count honest). (The contiguous room/category order is what persists; print continues to render its own room-group rows from the now-ordered data — a likely bonus fix for the flaky print grouping Cynthia reported.)

## 4. Acceptance (binary)
1. Manage toolbar on a proposal shows **Sort by ▾ (Room default / Category)**; same on invoices.
2. Applying **By Room** makes every room's lines contiguous in the project's room order; "Other" block (discounts/fees/unassigned) sits last; order **persists** after reload.
3. Applying **By Category** does the same keyed on category / master category order.
4. Each block has a working **collapse chevron**; Collapse all / Expand all work; collapsed state survives re-render.
5. **Total is byte-identical before and after** sorting; no line's money/status/content/id changes; line count unchanged.
6. Sorting a **client-approved** proposal leaves `clientApprovedTotalAt` intact (still approved/locked).
7. Existing manual groups stay intact (not split, not orphaned).
8. Client view is **unchanged** by this feature.
9. Verified on **staging** first; production only on Cynthia's typed GO.

## 5. Open choice for Cynthia (record answer before build)
- New lines added *after* sorting: **(A)** stay put until she clicks Sort again *(recommended — predictable)*, or **(B)** auto-slot into their block on add. Spec assumes **A** unless she picks B.

## 6. Sources / grounding
`platform/index.html`: reorder save pattern @9792 (also 9105/9195/10324/10587/10770), room-list source @10300-10307 + dbPickRoom @10311, category options @9738, collapse `toggleProposalGroupCollapse` @9776 / `toggleInvoiceGroupCollapse` @11443, group model `isProposalGroupHeaderItem` @9381 + block helpers @10687/10700, approval-lock deletion to AVOID @10368, Timely collapse-persistence pattern @17491. `platform/cch-product-categories.js`: master category order.

*Neptune_Oct01_v1.0 — Cloud Code spec, read-only grounding; no code changed. FEATURE, staging-first. #1 to assign WO number (not invented here). Cloud Code verifies on staging after build.*
