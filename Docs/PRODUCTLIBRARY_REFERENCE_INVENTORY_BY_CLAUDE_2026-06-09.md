# Product Library → `products/` Unification — Canonical Reference

**File:** PRODUCTLIBRARY_REFERENCE_INVENTORY_BY_CLAUDE_2026-06-09.md
**Status:** **CANONICAL** (single authority — Claude + Cursor reports reconciled & merged)
**Long-term home:** `CCH_Platform_Docs/_architecture/` (move here when that tree exists; this is the deploy-side working copy until then)
**Authors:** Claude Code (line inventory) + Cursor (rules + production data counts)
**Created:** June 9, 2026
**Last updated:** June 9, 2026
**Last revised by:** Claude — folded Cursor's `firestore.rules` section, production data counts, and revised merge order into one authority — June 9, 2026

## Revision log
- Jun 9, 2026 (Claude): Initial classified line inventory of deployed `productLibrary/` references.
- Jun 9, 2026 (Cursor): Independent report — added `firestore.rules`, production data counts, Phase-4 priority order; confirmed doc-id-merge blocker.
- Jun 9, 2026 (Claude): Reconciled both into this canonical doc. ⚠️ items closed (918=read, 769=write).

---

## End-state (one line)

**Product Library *screen* stays unchanged; all reads/writes go to `products/` only; the `productLibrary/` *collection* becomes dead code, then dead data.** Canonical declared in code: `CCH_PRODUCTS_COLLECTION = 'products'` (`index.html:10058`). Two tracks: **Track 1** = Ivy/image cutover on `products/` keepers (Bugletrail pilot, in progress); **Track 2** = collection unification (this doc), after the data merge.

---

## Production data counts (why you can't just flip a switch)

From `COMPARE_products_vs_productLibrary_BY_CLAUDE_2026-06-02.json` (production):

| Fact | Count |
|---|---|
| Rows in `products/` | 4,822 |
| Rows in `productLibrary/` | 4,527 |
| **Same doc id in both** | **11** |
| Same `houzzId`, **different** doc ids | 1,866 |
| **Duplicate `houzzId`s within `products/` alone** | **2,351** |
| Rows only in `productLibrary/` | 4,516 |
| Union doc ids (UI merge ceiling) | 9,338 |

**Reframing this forces (agreed by both):**
1. The dual-write-by-same-id mirror **barely ever worked** — only **11** properly mirrored pairs. The vast bulk of legacy data is **unlinked duplicates**, not "same id, two collections."
2. The merge is **not only cross-collection** — `products/` has **2,351 internal `houzzId` duplicates** and must be **deduped against itself first** (merge-not-junk, keep cost), then absorb the 4,516 legacy-only rows.
3. The UI merges by **doc id, not `houzzId`** (`index.html:51358`). Stopping `productLibrary/` reads before the merge would **drop thousands of rows the screen still shows.** → **Data before code, always.**

---

## Deployed-code reference surface

~74 hits across 7 live files (the other ~1,145 of 1,220 total are `_scripts/`/`_debug/` one-off tools — not deploy surface).

| File | Hits | Migration-relevant |
|---|---|---|
| `platform/index.html` | 53 | reads + writes + deletes + loader |
| `platform/builder/index.html` | 17 | 2 Firestore reads + in-memory state |
| `platform/cch-functions.js` | 2 | 1 read (918) + 1 comment |
| `platform/cch-design-board.js` | 1 | 1 read (359) |
| `platform/cch-product-categories.js` | 1 | comment only (216) |
| `Functions/index.js` (cloud fn) | 1 | 1 write (769) — separate deploy |
| `firestore.rules` | 4 | 2 collection rule blocks |

---

## `platform/index.html` — classified checklist

### WRITES — stop these (keep legacy alive). The 3 **birth sites** marked ★
| Line | Function | Pattern |
|---|---|---|
| 9354 | `cchLibraryUsageSyncDocument` | `set(merge)` mirror patch |
| ★ 10191 | `cchCreateLibraryProductFromClipData` | Clipper: `products.add` → `productLibrary.set` mirror |
| 51460 | `restoreJunkLibraryProduct` | `set(merge:false)` active restore |
| ★ 53313 | `importHouzzProductLibrary` | writes **only** `productLibrary/` (no `products/`) |
| 54536 | `saveProduct` update path | `productLibrary.update` then mirror to `products/` |
| ★ 54632 | `saveProduct` create path | manual Add: `products.add` → `productLibrary.set` mirror |
| 54963 | `_updateLibraryProductDual` | updates both; succeeds if either exists |
| 56039 | bulk lighting category fix | updates both |
| 66106 | `_clearCatalogRoomForRemovedClip` | clears room on both |

### READS — repoint to `products/` (only after data merge)
9342 (`cchLibraryUsageSyncDocument` fallback), 11532 (quick-load), 14316 (`renderSelectionsTab` where project), 15309 (`editSelectionItem` prefill), 16410 (inspiration/concept board cold-cache), 28450 (`pushLibraryPricesFromLineItem` fallback ref — Cursor context: read), 33797/33800 (doc sidebar where project/projectId), 34167 (tear-sheet picker), 34709 (Add-from-Library picker), 34863 (My Items full load), 53298 (import existing-key scan), 53344 (post-import reload — reloads `productLibrary` only, not merged), 54472 (`saveProduct` existing-row check), 54710 (`backfillSpecLinksFromLibrary`), 54829/54831 (Whitesail trial backfill), 54943 (`_updateLibraryProductDual` category guard), 55375 (`peLoadLinkedDocs` fallback), 69095 (spec-book export where projectId).

### DELETES
15777 (`selectionBatchDelete`), 15820 (`selectionDeleteOne`), 15868 (`selectionDedupeLibraryAgainstClips`), 53272 (`importHouzzProductLibrary` mode-2 rebuild wipe — read-then-delete), 54916 (`deleteProduct` dual delete).

### DYNAMIC LOADER
51529 — `_loadLibCol = _isJunk ? 'productLibrary_archive' : 'productLibrary'` (central catalog load; the legacy leg to remove).

### MERGE (in-memory, doc-id)
51358 `_mergeLibraryCatalogRows` (doc-id merge, protects image/category/cost), 51420 `_libIngestSnapIntoMap`, 11532 (concat-by-id), 34709/34863 (title+vendor dedupe in pickers), 54710 (absorb merge).

### COMMENT / DISABLED (no runtime effect; update text during refactor)
3702, 10057, 14361, 14365, 15427, 18788–18789 (auto-sync DISABLED), 34707, 50720, 51358, 51527, 54537, 54636 (console.warn), 54923, 69092.

### `productLibrary_archive` (Junk — KEEP, do not retire)
51445 (archive read), 51473 (archive delete), 55622 (detail dynamic loader).

---

## Satellite shipped files

- **`builder/index.html`** — reads 2175/2191 (paged load → merge by doc id into `state.productLibrary`); in-memory state 629/648–649/2200–2403 (rename in Phase 4, not Firestore); comment 2158.
- **`cch-functions.js`** — 918 **READ** (vendor detail queries both collections); 1059 comment.
- **`cch-design-board.js`** — 359 READ (cold-cache merge, same pattern as index.html inspiration load).
- **`cch-product-categories.js`** — 216 comment (category guard applies to both).
- **`Functions/index.js`** — 769 **WRITE** cloud-function mirror (`products.add` → `productLibrary.set`). **Separate deploy** (`firebase deploy --only functions`) — easy to forget.

## `firestore.rules` (retirement step 6)
```
311  match /productLibrary/{docId} {            // ← tighten to read-only, then remove
312    allow read: if isAuth();
313    allow write: if isAuth();
314  }
317  match /productLibrary_archive/{docId} {     // ← KEEP for Junk Library
318    allow read: if isAuth();
319    allow write: if isAuth();
320  }
```
Note: the `*_archive` read rules exist in the repo but are **not deployed to production** (verified Jun 9) — that's why the prod Junk tab reads empty. Separate from retirement.

---

## Revised merge order (data → code → retire)

```
1. products/ self-dedup            (by houzzId, merge-not-junk, keep cost)   ← NEW first step
2. cross-collection merge          (houzzId + cost from legacy unitCost; absorb 4,516 legacy-only)
3. ivy cutover on keepers          (Track 1 — broken Ivy → Firebase houzz-products/)
4. gallery images[] link
5. repoint reads → products/ only  (the ~22 read sites above)
6. stop writes                     (client birth sites 10191/54632/53313 + 9354/54536/54963/56039/66106 + cloud fn 769)
7. rules: tighten → remove productLibrary/ (keep productLibrary_archive/)
8. retire collection               (read-only archive → eventual delete)
```

## Highest-risk refactor targets (Phase-4 priority)
1. `loadProductLibrary` / `_loadLibCol` (~51527) — remove legacy load leg
2. `saveProduct` / `_updateLibraryProductDual` (~54470–54970) — stop mirror writes
3. `cchCreateLibraryProductFromClipData` (~10191) — single-collection create
4. Selections reads (~14316, 15309) — `products/` queries
5. `importHouzzProductLibrary` (~53265) — write `products/` only, or retire
6. Selection deletes (~15777–15868) — `products/` only
7. `cchLibraryUsageSyncDocument` (~9354) — single-collection patch
8. Builder `loadProductLibrary` — drop legacy pagination leg
9. Cloud Function mirror (`Functions/index.js:769`)
10. `firestore.rules` — archive then remove write rule

---

*Read-only inventory and planning doc. No platform code or Firestore data was modified to produce or merge this. The migration itself runs only on Cynthia's explicit GO, staging-first, dry-run, per the deployment rules.*
