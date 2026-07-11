# WO-014 · Universal (all-projects) FFE Schedule — sortable by category + project, under Finance · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## What Cindy asked (Jul 11)
"Can we get a universal all-projects FFE that we can sort by category and project, and add it to the left
panel under Finance." She loves the room/category sort on the per-project board and wants the same power
across every project in one view.

## Shape — CONFIRMED by Cindy (Jul 11): filter-first, Houzz-style
Cindy: "It should load EMPTY, then we select the project and category and Apply. Houzz had options for what
showed and/or was exported: SKU, pricing, description, room, cost, qty, pending, declined, invoiced,
proposal, etc." (See her Houzz Selections Tracker screenshot — Sort by / Organize by / Filters / Item
Properties column picker / Export.)

**So it is a query-builder table, not an eager dump:**
1. **Loads empty.** Show a filter bar + an empty state ("Select project(s) and category, then Apply").
   Nothing loads until Apply — this also solves the all-projects performance worry (no full sweep unless she
   asks for it).
2. **Filters:** Project (multi-select, incl. "All"), Category (multi-select, incl. "All"), and status
   (Pending / Approved / Invoiced / Declined). **Apply** button runs the query and fills the table.
3. **Column picker ("Item Properties"), Houzz-style** — toggle which columns show: Image, SKU, Title,
   Description, Vendor, Room, Category, Project, Qty, Price (sell), **Cost** (admin-only), **Margin**
   (admin-only), Status (Pending/Approved/Invoiced/Declined), linked docs (Proposal / Invoice / PO). Default
   ON: Image, Title, Vendor, Room, Category, Project, Qty, Price, Status. Persist her choice (localStorage).
4. **Export** the current view (respecting column picker + filters) to CSV/Excel, Houzz-style. Export must
   honor the admin gate — a Vanessa export never contains Cost or Margin columns.
5. **Group/sort toggle Category ↔ Project** still applies to the loaded result set, plus column sort.
> Phase 2 (flag, not now): firm-wide budgets / invoiced-analytics rollup. Default stays the schedule table.

## Grounded anchors (verified in index.html this session)
- **Nav (Finance group):** `index.html:3093` (`<div ...>Finance</div>`), siblings `data-page="allproposals"`
  (:3094), `allinvoices` (:3097), `allpos` (:3100). Add a new button here.
- **Route dispatch:** `navigate()` at :4603; page map at :4716–4718 (`allproposals→renderAllProposals`,
  `allinvoices→renderAllInvoices`, `allpos→renderAllPOs`); hash guards at :3489–3497. Add `allffe→renderAllFFE`
  the same way (page `allffe`, hash `#/allffe`).
- **All-projects enumeration pattern:** `db.collection('boards').get()` → build `allProjects[]`
  (:5624–5638), then per-project subcollections loaded in parallel with a "Loading … (N projects)" state
  (:5634, :5638). There's a cached boards promise `_boardsCachePromise` at :3401 — reuse it.
- **Per-project FFE load (copy its data shape):** `renderFFETab(T, proj)` at :27260 loads
  `boards/{id}/clips` (+ purchaseOrders, roomMeta, invoices) then filters to products via
  `ffeFilterProductClipsOnly(clips)` (:26984). Use the SAME filter so "what is FFE" matches the per-project
  tracker exactly (no design fees, tax, shipping, time-billing rows).
- **Status (keep consistent with WO-013 + FFE):** `getClipApprovalStatus(clip)` (:20020) for
  approved/declined/pending; invoiced = `clip.invoiceId || clip.invoiceNum || clip.houzzInvoice`; FFE's own
  helper `cchFfeEffectiveSelectionStatus` (:26974). Derive row status the same way the board strip does.

## What to build
1. **Nav entry** under Finance (`index.html:3093` group): `<button class="nav-item" data-page="allffe">` with
   label **"FFE Schedule"** (icon 🛋️ to match the FFE tab, :14579). Place it right after Purchase Orders
   (:3100) or after Bill variances — Cursor's call, keep it in the Finance group.
2. **Route:** add `allffe` to the navigate() page map (:4716-block) → `renderAllFFE()`; add the hash guard
   near :3489 (`if (hash.indexOf('allffe') >= 0) { if (typeof renderAllFFE === 'function') renderAllFFE(); return; }`).
3. **`renderAllFFE()`** — new function near the other `renderAll*` renderers:
   - Render the **filter bar + empty state first** (project multiselect from the cached boards list, category
     multiselect, status filter, column-picker menu, Apply, Export). Populate the project list from
     `_boardsCachePromise` (names only — cheap; no clip load yet).
   - On **Apply**: load `clips` for ONLY the selected project(s) (parallel, with a "Loading FFE…" state),
     run `ffeFilterProductClipsOnly`, filter to the selected categories/status, tag each row with
     `{ projectId, projectName }`.
   - Render the table with the picked columns. **Group toggle Category ↔ Project** (reuse the board's
     grouping approach — `catGrouped` vs a new `projGrouped`), plus clickable column sort (reuse
     `ffeSort`/`ffeSortArrow` :26766/:26773 if they generalize; else local).
   - Status chip per row from the shared status derivation (Pending/Approved/Invoiced/Declined).
   - Row click → deep-link to that item's project board (`#/project/{projectId}/boards`).
4. **Column picker + Export** as in the Shape section. Persist column choice in localStorage.
5. **Permissions (hard):** Cost and Margin are **admin-only columns** (ADMIN_EMAILS gate) — Cindy sees them,
   Vanessa never does, in BOTH the table and the export. Everything else (SKU, price, room, qty, status,
   doc links) is fine for Vanessa. This is why load-empty + explicit columns matters: the gate is applied
   when building columns, not bolted on after.

## Performance — largely solved by filter-first
Because it loads empty and only queries the selected project(s) on Apply, the full-fleet sweep only happens
if she explicitly picks "All projects". Still: if "All" is chosen, load clips in parallel with a visible
progress/count and reuse `_boardsCachePromise`; log any cap in the UI (no silent truncation). Do not eager-
load every project's clips on page open.

## Constraints
- Reuse `ffeFilterProductClipsOnly` and the shared status helpers — do NOT invent a second definition of
  "what is FFE" or a second status vocabulary.
- Navy/gold, no gray boxes; never split index.html; `node --check` + tail after edit.
- Admin/Vanessa: no Cost/Margin columns. Sell/Price OK.

## Acceptance (binary)
1. "FFE Schedule" appears in the left nav under Finance and routes to `#/allffe`.
2. **Page loads EMPTY** — no clips load until Apply. Empty state prompts for project + category.
3. Selecting project(s) + category (+ optional status) and clicking Apply loads matching FFE rows; each row
   shows its Project; the set matches the per-project FFE tracker for a spot-checked project (same
   `ffeFilterProductClipsOnly`).
4. Column picker toggles columns (SKU, description, price, qty, status, doc links, etc.); choice persists.
5. Export outputs the current view (picked columns + filters) to CSV/Excel.
6. Group toggle switches Category ↔ Project; column sort works.
7. Status chips read Pending/Approved/Invoiced/Declined consistent with the board strip (WO-013).
8. **As a non-admin (Vanessa) session, Cost and Margin columns are absent from BOTH the table and the export;
   the picker doesn't offer them.** As admin, they're available.
9. Row click deep-links to the correct project board.
10. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
Open FFE Schedule; confirm rows span multiple projects; toggle Category↔Project; sort a column; spot-check
one project's rows against its per-project FFE Tracker; confirm no Cost/Margin. Screenshot to loop/verify/WO-014/.

## DONE note
loop/WO-014_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
