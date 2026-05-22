# Session log — Cursor, 2026-05-14

**Workspace:** `CCH-Platform-Deploy`  
**Related prior log (2026-05-13, different agent):** [`SESSION_LOG_Claude_2026-05-13.md`](./SESSION_LOG_Claude_2026-05-13.md) — client portal / staging / prod deploy notes (already in repo; not produced in this Cursor thread).

**Note on “yesterday”:** During the 2026-05-14 Cursor work, no separate markdown session file was written for “yesterday”; handoff text lived in chat summaries only. This document **saves today’s Cursor session** in full and **§8** captures the **2026-05-11** summarized handoff from the earlier conversation.

---

## 1. Non-products in “product” surfaces (Project Selections / products)

### Issue

Room-board and proposal flows surfaced **labor, expenses, and services** next to real FFE (e.g. a line titled **“Expense”** under **Project Selections** with real products). Expected: **products only** in product-style lists; billing lines belong under **Design / Labor / Expense**.

### Root causes

- `isRealProduct` had an early branch that could treat **`libraryItemKind` / `itemKind` of `expense` or `design_service`** as valid for some paths, so tagged rows could still behave like “selections.”
- Bare titles like **`Expense`** did not match the older title regex / `serviceTerms` list.
- **Project Selections** rail filtered by search and proposal exclusions but **not** by `_cchSidebarClassifyItem`, so QB/category-based “service” rows could still appear if they slipped past the loader.

### Fixes (`cch-deploy/platform/index.html`)

- **`isRealProduct`:** removed the “always allow” behavior for expense/design_service rows; **reject** at top for `design_service`, `expense`, `labor`, `service` kinds.
- **Titles:** reject whole-line billing titles (`expense`, `labor`, `services`, etc.) and add **`expense` / `expenses`** to `serviceTerms`.
- **`_disSidebarItemIsProjectSelectionProduct`:** broaden title/description regex (e.g. **expense**, **reimbursable**, **pass-through**).
- Pass **`libraryItemKind` / `itemKind`** into `isRealProduct` from proposal sidebar and the main Selections pipeline so tagged rows are excluded.
- **Project Selections list:** after building the list, keep only items where **`_cchSidebarClassifyItem`** is **`product`** or **`bundle`**.
- Align the **Selections** pipeline title regex with the sidebar (same billing phrases).

---

## 2. “Never on the room board” — block bad clips at the source

### Issue

Wanted **labor / expense / service lines never stored as room-board clips**, not only hidden in the UI.

### Fixes

#### A. Firestore rules (`cch-deploy/firestore.rules`)

- **`boards/{projectId}/clips/{docId}`:** **`create`** and **`update`** require **`clipBoardWriteOk(request.resource.data)`**.
- Blocks: bad **`libraryItemKind` / `itemKind`**, **`expenseType`**, **`lineType` / `itemType` / `cchLineCategory`**, bare billing **titles**, and **category/room** set to obvious fee/service buckets.
- **Deletes** unchanged (auth still required).
- **Note:** Admin SDK / scripts bypass rules.

#### B. Studio client (`index.html`)

- **`boardClipWriteAllowedForRoomBoard`:** delegates to **`_disSidebarItemIsProjectSelectionProduct`** before relevant **clip creates** (ideabook → room, lightbox copy, add product to project, FFE new row, **selections → `clipRef.set`**, Houzz import rows, tear-sheet import).
- **Selections → room board:** copy **`expenseType` / kinds** from source rows; **skip** bad rows with a toast instead of writing.
- **`_disPersistAppendedRows`** (selections mode): same guard + skip.

#### C. Clipper (`cch-clipper/.../sidebar.js`)

- **`clipperGuardRoomBoardClip`:** mirrors key Studio checks before **`fsCreate`** on `boards/.../clips`.

### Deploy reminder

- `firebase deploy --only firestore:rules`
- Ship **`index.html`** with the guards.

---

## 3. Clipper: new room not appearing on the project

### Issue

**+ New room** in the Clipper updated the UI but **did not reliably create the room in Studio** (Studio uses **`roomMeta`** plus merged room lists).

### Fixes (`sidebar.js`)

- **`fsUpsertRoomMeta`:** `POST` `boards/{pid}/roomMeta?documentId={slug}` with **`name`**, **`coverImage`**, **`createdAt`** (aligned with Studio **`createNewRoom`** slugging). On **409 / ALREADY_EXISTS**, **`PATCH`** name + **`updatedAt`**.
- **`addNewRoom`:** call **`fsUpsertRoomMeta`** before patching the board; patch **`rooms`**, **`projectRoomList`**, **`updatedAt`**; **`await loadRooms()`** after success; **surface errors** in status and **remove** the optimistically added `<option>` on failure.

---

## 4. Clipper “rev name” / version visibility

### Issue

Folder name **`CCH-Studio-Clipper-v32`** did not match manifest version; wanted revision to track the real build.

### Fixes

- Header meta: **`VS #`** → **`v{manifest.version}`**.
- **Manifest** stepped with clipper changes (through **3.9.14** in this thread).

### Note

Renaming the extension folder on disk to match version was not reliably completed in the agent environment; you can rename locally (e.g. **`CCH-Studio-Clipper-v3.9.14`**) and **re-point “Load unpacked”** in `chrome://extensions`.

---

## 5. Pattern repeat — entry + clip (shadow DOM)

### Issue (round 1)

Native **`<select>`** for Pattern repeat was hard to use inside the **shadow DOM**.

### Fix (round 1)

- **Segment control** (Not set / Vertical / Horizontal) + hidden **`#patternRepeatVal`**.

### Issue (round 2)

No way to **type** repeat sizes or use **🎯** on the page (unlike Dimensions).

### Fix (round 2)

- **`fPatternH`** / **`fPatternV`:** text inputs + **🎯** (`data-f` with existing pick mode).
- **`clipperSanitizePickedText`:** max **120** chars for those field ids.
- **Save / library:** `patternRepeatHorizontal`, `patternRepeatVertical`, `patternRepeat` (direction).
- **Merged description:** `Horizontal repeat: …`, `Vertical repeat: …`, optional `Pattern repeat direction: …`.
- **Gemini prompt:** `patternRepeatHorizontal`, `patternRepeatVertical`, `patternRepeatDirection` (+ backward compat for legacy `patternRepeat` as direction only).
- **`fillPatternRepeatsFromSpecText`:** parses spec-table text into H/V when empty; used from **Append specs from page** and **auto-extract** when a spec block exists.

**Manifest:** bumped to **3.9.14** for this batch.

---

## 6. Earlier handoff (2026-05-11 conversation summary)

Work completed in a **prior Cursor session** (summarized into the 2026-05-14 thread); included here for one paper trail.

| Area | Issue | Fix (high level) |
|------|--------|------------------|
| **Clipper Quick Clip** | Room board as destination caused confusion | Quick Clip **ideabook-only**; Room Board removed from Quick Clip UI (`sidebar.js` + manifest). |
| **Studio Holtz / rooms** | Missing **Living Room** etc. when board data incomplete | **`_fetchProjectBoardRoomList`:** merge **`projectRoomList`**, **`projectRoomsText`**, coerce **`board.rooms`**, **`roomMeta`**, clips, **`_defaultProjectRoomSuggestions()`**. |
| **Proposals** | Stuck on **Loading…** / huge clip reads | **`renderProposalDetail`:** **try/catch** + visible error; **`backfillProposalLinesFromMatchingClips`:** clips **`.limit(1500)`**. |
| **Product categories** | Fee/labor/service strings in product lists | **`NOT_FFE_CATEGORY_LABEL`** in **`cch-product-categories.js`** + clipper; **cache `?v=`** on script in **`index.html`**. |

---

## 7. Local checklist

1. Deploy **`index.html`** + **`firestore.rules`** (+ **`cch-product-categories.js`** if part of your bundle).
2. Chrome: **Reload** unpacked Clipper (folder may still be **`CCH-Studio-Clipper-v32`** unless renamed).
3. Optional: rename extension folder to match **manifest `version`** and reload unpacked from the new path.
4. **Legacy clips:** existing bad documents remain until delete/edit; rules may block updates until **`clipBoardWriteOk`** passes — use Studio cleanup (e.g. **`removeTimeBillingBoards`**) or admin scripts.

---

## 8. Files touched (this Cursor workstream)

| File | Role |
|------|------|
| `cch-deploy/platform/index.html` | Selections / `isRealProduct` / guards / imports / selections `set` |
| `cch-deploy/firestore.rules` | Clip create/update validation |
| `cch-clipper/CCH-Studio-Clipper-v32/sidebar.js` | Room create, room-board guard, pattern repeat UI + save + spec fill |
| `cch-clipper/CCH-Studio-Clipper-v32/manifest.json` | Version bumps (through **3.9.14**) |
| `cch-deploy/platform/cch-product-categories.js` | (handoff) `NOT_FFE_CATEGORY_LABEL` |

---

*End of log — 2026-05-14*
