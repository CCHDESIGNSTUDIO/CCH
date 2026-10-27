# Product Library Isolation — Code Handoff

**File:** CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md  
**Original Author:** Cursor (CR)  
**Created:** June 2, 2026  
**Last Modified:** June 2, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0

## Revision history

- v1.0 (Jun 2, 2026, CR): Handoff for Claude Code — stop backward sync into Product Library; preserve forward library edits (cost, images, category).

---

## Executive summary

Cynthia’s Product Library (`#/library`) is being **corrupted by backward sync**: room names appear in the **Category** column (`Reading Room`, `Game room`, `MBR & Bath`, `Hall L2`, `Kitchen`), images on room-board clips and proposal lines get overwritten, and gallery edits do not stick.

**The rule:** Product Library is a **catalog you edit in the library UI**. It is **not** a mirror that project data pushes into.

| Direction | Allowed? |
|-----------|----------|
| Library → proposal/invoice line via **Apply from Library** button | Yes (explicit only) |
| Library → clip on `saveProduct` / auto-sync | **No** |
| Clip / room board / selections / proposal → library | **No** |
| User edits cost or image in `#/library` | **Yes** |

**Live site** (`cch-platform.web.app`) may still run older hosting until `firebase deploy --only hosting:platform` with cache-bust `cch-doc-isolation.js?v=20260603d`.

**Do not run Firestore batch scripts on live projects without Cynthia naming and approving the exact script.**

---

## Symptoms (what Cynthia sees)

1. **Category column shows room names** on lighting products that should say `Lighting` (see Tailor Leather Cone / Elu vendor list screenshot, Jun 2026).
2. **Images reappear** after delete or save on room-board **Edit room board item** modal.
3. **Wrong photos** on proposal lines linked by `clipId` or `libraryProductId`.
4. **Repeated cleanup** — same items corrupted again after library or clip saves.

---

## Root causes (code-grounded)

### A. Library save pushed outward to clips

`saveProduct()` called `syncProductToClips()` on every Product Library save. That function matched clips by `libraryProductId` **or fuzzy title+vendor** and wrote prices, title, vendor, sku, URLs, and (historically) **`images`** to clips across all projects.

- Function: `syncProductToClips` ~`index.html:54359`
- Callers removed from `saveProduct`; function body is now a **no-op** unless `explicitApplyFromLibrary` (still verify).

### B. Clip save pushed outward to docs and library

Room-board `saveProduct` clip path used to:

1. **Mirror** clip fields (including `category`, `imageUrl`, `images`) → `products/` + `productLibrary/`
2. Call **`cchPushClipImagesToLinkedDocLines`** → overwrote proposal/invoice line images by `clipId`

- Clip mirror: **removed** from clip save path (~`54138` area).
- `cchPushClipImagesToLinkedDocLines`: **gated** at function entry; call **removed** from clip save.

### C. Project UI wrote backward into library

| Path | What it did |
|------|-------------|
| `setSelectionItemRoom` | Wrote `room` to `productLibrary` + `products` when assigning room from Selections |
| `setSelectionItemCategory` | Wrote `category` to library from Selections |
| `selEditSave` | Updated library row when `item.source === 'library'` |
| `pushLibraryPricesFromLineItem` | Doc line prices → library (partially blocked by `cchGuardDocBackSync`; add `cchGuardLibraryWrite`) |
| `_clearCatalogRoomForRemovedClip` ~`65596` | Still updates `products/` + `productLibrary/` when clip removed |
| Clip → library mirror on `saveProduct` | Wrote clip `category` (often a **room name** from Houzz) into library `category` |

**Selections paths:** `setSelectionItemRoom` / `setSelectionItemCategory` / `selEditSave` library writes **removed or clip-only** in local `index.html` (verify).

### D. Category column = stored `p.category` (not a display bug)

`renderLibraryView` list table renders:

```javascript
esc(p.category || '')  // ~53251 — now uses libraryDisplayCategory() helper
```

Room names in the column mean **`category` field in Firestore** was polluted (often from clip→library mirror or Houzz import putting room in category). `cchStringLooksLikePhysicalRoom()` in `cch-product-categories.js` detects many but not all (e.g. `Reading Room` may need `\broom\b`).

### E. Gallery / delete felt broken (room-board modal)

When a clip has `libraryProductId`, the edit modal had `p.id` set → gallery used **library** remove path (`_peRemoveImg`) instead of **clip** path (`_peRemoveClipImg`), and strict URL equality caused silent delete failure. Refresh could re-inject images from `libraryProducts` cache.

**Local fixes:** clip gallery branch wins when `_clipDocId` set; normalized URL compare; in-memory hero/remove until Save.

### F. Display-only (looks like swap, no write)

`getBestImageUrl()` ~`11150` shows library or clip fallback when stored URL empty/unreliable. Firestore unchanged but UI looks wrong.

---

## Architecture target (iron-clad)

```
┌─────────────────┐     explicit "Apply from Library"      ┌──────────────────┐
│ Product Library │ ──────────────────────────────────────►│ Proposal/Invoice │
│  (#/library)    │                                        │      line        │
└────────┬────────┘                                        └──────────────────┘
         │
         │  user Save in library UI only (cost, images, category)
         ▼
   products/ + productLibrary/

┌─────────────────┐
│ Room board clip │  Save → boards/{project}/clips/{id} ONLY
└─────────────────┘  NO → products/, NO → proposals, NO fuzzy sync
```

### Guard functions (implement / finish wiring)

**File:** `platform/cch-doc-isolation.js` (cache-bust `?v=20260603d`)

| Guard | Purpose |
|-------|---------|
| `cchGuardCrossEntitySync` | Blocks `syncProductToClips`, `cchPushClipImagesToLinkedDocLines`, `clipToLibraryMirror` unless explicit flags |
| `cchGuardLibraryWrite` | Blocks **any** write to `products/` / `productLibrary/` unless `explicitLibraryEdit`, `allowNewLibraryProduct`, or inside `cchRunAsLibraryEdit()` |
| `cchRunAsLibraryEdit(fn)` | Increments `_cchLibraryEditDepth` around library UI save paths |

**All library writes must go through `_updateLibraryProductDual(productId, update, opts)`** or be inside `cchRunAsLibraryEdit`. Direct `db.collection('products').doc().update()` bypasses the guard unless depth > 0.

---

## Already in local repo (verify + complete)

### `cch-doc-isolation.js`

- `cchGuardCrossEntitySync` — present
- `cchGuardLibraryWrite` + `cchRunAsLibraryEdit` — present (v20260603d)

### `index.html` — done or partial

| Change | Status |
|--------|--------|
| `syncProductToClips` disabled (no-op) | Done |
| Removed `syncProductToClips` calls from `saveProduct` | Done |
| Removed clip→`products/` mirror on clip save | Done |
| Removed `cchPushClipImagesToLinkedDocLines` call on clip save | Done |
| Gate `cchPushClipImagesToLinkedDocLines` at function entry | Done |
| `saveProduct` library path wrapped in `cchRunAsLibraryEdit` | Done (`_saveProductLibraryOnly`) |
| `_updateLibraryProductDual` checks `cchGuardLibraryWrite` | Done |
| `_pdUpdateField` uses `explicitLibraryEdit` + `cchRunAsLibraryEdit` | Done |
| `pushLibraryPricesFromLineItem` checks `cchGuardLibraryWrite` | Done |
| Selections: no library writes in `selEditSave`, `setSelectionItemRoom`, `setSelectionItemCategory` | Done |
| `_mergeLibraryCatalogRows` — reject incoming room-like `category` when existing is canonical FFE | Done (~`51122`) |
| `libraryDisplayCategory()` — list column hides polluted room-as-category | Done |
| Room-board gallery: clip path for delete/hero; no library clip side-effects on `_peSetPrimary` / `_peRemoveImg` | Done |
| `syncClipsToMasterLibrary` disabled | Was already disabled |
| Proposal open `backfillProposalLinesFromMatchingClips` commented out | Verify ~`26899` |

---

## Code must still finish

### 1. Wire `explicitLibraryEdit` on all remaining library UI writers

These call `_updateLibraryProductDual` **without** `explicitLibraryEdit` and will **throw** once guard is strict:

| Location | Function |
|----------|----------|
| ~`9721` | `plApplyLibraryImageImpact` |
| ~`54881` | `_peSetPrimary` |
| ~`54930` | `_peRemoveImg` |
| ~`54972` | `_peAddImg` |
| ~`55561–55704` | `_pdUploadImage`, `_pdAddImage`, `_pdRemoveImage`, `_pdSetPrimary`, category/pricing helpers |
| ~`55676` | `_pdSetCategory` / detail panel |

**Fix pattern:**

```javascript
await _updateLibraryProductDual(productId, update, {
  explicitLibraryEdit: true,
  source: '_pdUploadImage'
});
// OR wrap entire handler in cchRunAsLibraryEdit(async () => { ... })
```

### 2. Block or remove remaining direct library writes (bypass guard)

| File:area | Function | Action |
|-----------|----------|--------|
| ~`65596` | `_clearCatalogRoomForRemovedClip` | **Remove** library updates; clip-only or no-op |
| ~`19967` | `ibExecuteIdeabookPromote` | Keep **new** library create; block **update** of existing row unless `cchRunAsLibraryEdit` |
| ~`10174` | `cchCreateLibraryProductFromClipData` | Only for **explicit** clipper capture; never from room-board save |
| ~`55734` | `cchBulkFixLightingCategoriesFromLibrary` | Admin console tool — OK if user-confirmed; wrap in `cchRunAsLibraryEdit` |

Grep to audit:

```bash
rg "collection\('products'\)|collection\('productLibrary'\)|_updateLibraryProductDual" platform/index.html
```

Every hit must be classified: **library UI forward** (allowed) vs **backward sync** (block).

### 3. Ensure `_peUploadImage` / list inline upload work after guard

List view upload: `onchange="window._pdUploadImage(this.files[0],'"+p.id+"')"` — must pass `explicitLibraryEdit` inside `_pdUploadImage`.

### 4. Category pollution — data vs code

- **Code:** stops new pollution (merge guard + no backward writes).
- **Existing bad rows** in Firestore still have `category: "Kitchen"` etc. Cynthia fixes via **Edit** → Category dropdown (`cchStrictFfeCategoryPickerList()` — canonical 21 FFE categories only).

Optional **admin-only** repair tool (user must confirm, dry-run first):

- Scan `products` + `productLibrary` where `cchStringLooksLikePhysicalRoom(category)` and title implies lighting → set `category: 'Lighting'`, set polluted value to `room` only if `room` empty.
- Output CSV `PRODUCT_LIBRARY_CATEGORY_REPAIR_BY_CLAUDE_<date>.csv` — **do not** blind batch on live without approval.

### 5. Deploy + verify

```powershell
cd c:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
firebase deploy --only hosting:platform
```

Hard refresh (`Ctrl+Shift+R`). Console must show:

`[cch-doc-isolation] loaded v20260603d`

### 6. Regression test checklist

| # | Action | Expected |
|---|--------|----------|
| 1 | `#/library` → change **Trade cost** inline | Saves; no toast about clips updated |
| 2 | Library → upload image on row | Saves to that product only |
| 3 | Room board → Edit item → remove wrong thumb → Save | Clip updated; **library row unchanged**; proposal lines unchanged |
| 4 | Product Library Save (Edit all fields) | Library row updated; **no** `Updated N clip(s)` toast |
| 5 | Selections → change room on library-sourced row | Clip/room board only; **no** `productLibrary` write |
| 6 | Proposal line editor → **Apply from Library** | Only that line’s image changes after Save |
| 7 | Open proposal with linked clip | `getBestImageUrl` may show fallback — distinguish display vs Firestore (check Network / Firestore console) |

---

## Key files

| File | Role |
|------|------|
| `platform/index.html` | Monolith — `saveProduct`, gallery, `renderLibraryView`, selections |
| `platform/cch-doc-isolation.js` | `cchGuardCrossEntitySync`, `cchGuardLibraryWrite`, `cchRunAsLibraryEdit` |
| `platform/cch-product-categories.js` | Canonical categories, `cchStringLooksLikePhysicalRoom`, `cchCategoryIsProtected` |
| `Docs/CLEANUP_HISTORY.md` | Houzz taxonomy; re-import guards |

---

## Explicit non-goals

- Do **not** re-enable `syncProductToClips` on library save.
- Do **not** re-enable clip→library mirror on room-board save.
- Do **not** run bulk Firestore fixes on **cloud-rolling-hills** / live client projects without Cynthia approving the script by name.
- Do **not** commit or deploy unless Cynthia asks.

---

## Junk Library / quarantine (separate from isolation)

### What Cynthia expected

Bad catalog rows moved out of the active Product Library into **🗑️ Junk Library** so she can review and restore or delete — not left in the main list.

### What actually happened

1. **Quarantine is a batch script, not automatic on save.** There is **no** in-app “Move to Junk” button today. The only bulk mover is:
   - `cch-deploy/_scripts/quarantine-products-library_BY_CLAUDE_2026-06-02.js`
   - Dry-run by default; `--apply --backup` moves docs from active → archive collections.

2. **Apply did run on production (`cch-design-boards`).** Backup plan: `_backup/products-library-quarantine-2026-06-02/quarantine-plan-applied_BY_CLAUDE_2026-06-02.json` (5564 planned moves, Jun 4 2026).

3. **Firestore archive is NOT empty** (admin count, Jun 2026):
   - `productLibrary_archive`: **4201**
   - `products_archive`: **1396**
   - Active: `productLibrary` 4530, `products` 4831

4. **If Junk Library UI shows “No quarantined items”** while counts above are true → likely **hosting not deployed** with junk-mode code (`setLibraryCatalogMode('junk')` loads `products_archive` + `productLibrary_archive` in `renderProductLibrary` ~51275), or client read failure (check browser console on `#/library` → Junk toggle).

5. **Room-as-category pollution is NOT junk.** Script `classifyJunk()` targets spec junk, `not-real-product`, weak stubs (`junkScore`). Legitimate products with `category: "Reading Room"` / `"Kitchen"` stay in **active** catalog — that is a **category cleanup** problem, not quarantine. Fix via library Edit + `libraryDisplayCategory()` display helper (already in local `index.html`).

6. **`dedupProductLibrary()` in UI** permanently deletes junk/duplicates — it does **not** move to archive.

### Code follow-ups (junk)

| # | Task |
|---|------|
| J1 | Deploy hosting so Junk Library toggle + `restoreJunkLibraryProduct` (~51184) ship to `cch-platform.web.app` |
| J2 | After deploy: Cynthia toggles **🗑️ Junk Library** — should see ~4k rows; if still empty, debug client `get()` on `productLibrary_archive` (rules allow auth read ~317) |
| J3 | Optional: per-row **Move to Junk** in library UI (write to archive + delete active, mirror script logic) |
| J4 | Optional: extend quarantine rules for `cchStringLooksLikePhysicalRoom(category)` — **only with Cynthia-approved script**, not silent auto-junk |
| J5 | Do **not** re-run `--apply` without explicit approval; use `count-archive-library.js` for status |

---

## One-paragraph brief for Code

Product Library backward sync is the bug. Clips, selections, and library saves were writing into each other (especially **images**, **category**, **room**, **cost**). Local work added `cchGuardLibraryWrite` / `cchRunAsLibraryEdit`, disabled `syncProductToClips`, removed clip→library and clip→proposal image pushes, and stopped selections from updating library. **Finish wiring `explicitLibraryEdit` on every library UI write path**, audit and block remaining direct `products/` / `productLibrary/` updates (especially `_clearCatalogRoomForRemovedClip`), deploy hosting with `cch-doc-isolation.js?v=20260603d`, and give Cynthia a way to fix already-polluted categories from the library UI without project data overwriting her edits again.
