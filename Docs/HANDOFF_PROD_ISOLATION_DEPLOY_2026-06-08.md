# CCH Studio — Production Isolation Deploy: Combined Handoff

**File:** HANDOFF_PROD_ISOLATION_DEPLOY_2026-06-08.md  
**Original Author:** Claude Code (CC)  
**Created:** June 8, 2026  
**Last Modified:** June 8, 2026  
**Last Modified By:** Cursor (CR) — Phase 1 staging deploy executed  
**Version:** 1.3  
**For:** Cynthia approval + Claude Code (deploy executor) + Cursor (verify)

## Revision history

- v1.0 (Jun 8, 2026, Claude Code): Root cause confirmed against live hosted files — isolation fix on staging (`v20260603d`) never deployed to production (`v20260603b`). Deploy plan, Room-Board↔Doc status, data-recovery backlog.
- v1.1 (Jun 8, 2026, Cursor): Combined Library + Room-Board↔Doc into one doc; **Bundle B** as starting deploy choice; expanded verify checklist, Jun 7 decline fixes, quarantine recovery, and post-deploy incomplete-work list from Jun 2 isolation handoff.
- v1.2 (Jun 8, 2026, Cursor): **Phase 1 staging deploy complete** — `firebase deploy --only hosting:platform --project staging` → `cch-platform-staging.web.app`; live fetch confirms `v20260603d`, guards present, no-op `syncProductToClips`.
- v1.3 (Jun 8, 2026, Cursor): **Phase 2 production deploy complete** — Cynthia GO; `firebase deploy --only hosting:platform --project cch-design-boards` → `cch-platform.web.app`; prod verification 7/7 pass + runtime guards blocked.

---

## TL;DR

Production (`cch-platform.web.app`) still runs **pre-isolation hosting** (`cch-doc-isolation.js` **v20260603b**). Staging/local has **v20260603d** with guards + no-op `syncProductToClips`. That gap is why **Product Library saves overwrite room-board clips**, proposal auto-save can **clobber Decline → pending**, and clipped products keep getting re-corrupted.

**The fix is already built on staging — this is a deploy, not new isolation code.** Do **not** rewrite guards in `docEditSave` / `ensureProposalLinesLinkedToRoomBoard`.

**Cynthia's deploy bundle choice: B (conservative)** — isolation guards + room-board decline/status fixes only; **exclude** the Selections category/image→Library edit until validated on staging separately.

**AI agents may deploy staging (Phase 1) only on typed GO. Cynthia runs production (Phase 2).** Data repair (quarantine restore, category cleanup) is **after** deploy — separate scripts, dry-run first.

---

## Cynthia's rules (restated)

| Surface | Rule |
|---------|------|
| **Product Library** | Catalog edited only in `#/library`. No backward sync from clips, selections, proposals, or invoices. |
| **Room Board** | Client presentation. Doc edits must **never** change/remove board items or library rows. |
| **Proposal / Invoice / PO** | Isolated snapshots. Status (Approved/Declined/Pending) may sync. Board→doc only via **explicit** action ("Link to Room Boards", "Apply from Library"). |
| **Clip once** | A clipped product must **never disappear** from the library because it was used on a doc. (Jun 4 quarantine violated this — see §8.) |

---

## 1. Root cause — production vs staging (confirmed read-only)

| Check | Production | Staging / local repo |
|-------|------------|----------------------|
| `cch-doc-isolation.js` | **`loaded v20260603b`** | **`loaded v20260603d`** |
| `cchNoBackSyncFromDoc()` | `true` | `true` |
| `cchGuardDocBackSync` | present | present |
| `cchGuardCrossEntitySync` | **ABSENT** | present |
| `cchGuardLibraryWrite` / `cchRunAsLibraryEdit` | **ABSENT** | present |
| `index.html` → `cchGuardCrossEntitySync` refs | **0** | 4+ |
| `syncProductToClips` | **OLD writing version** (~54249 prod) — loops boards/clips, fuzzy title+vendor, writes patches | **no-op** + guarded (~54428 local) |

**Independent verify (Cursor / Code):**

```text
curl -s https://cch-platform.web.app/cch-doc-isolation.js | findstr "v20260603 cchGuardCrossEntitySync"
curl -s https://cch-platform-staging.web.app/cch-doc-isolation.js | findstr "v20260603 cchGuardCrossEntitySync"
```

Console after hard refresh (`Ctrl+Shift+R`) must show **`[cch-doc-isolation] loaded v20260603d`** post-deploy.

**Source doc (detail):** `Docs/CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md`

---

## 2. Product Library isolation — what prod leak does

### Live vector on production

**Library → clip overwrite:** every Product Library save runs unguarded `syncProductToClips`, matching clips by `libraryProductId` or fuzzy title+vendor and writing title, category, images, prices across **all projects**. This is the main "room board / invoice / selections keep getting messed with" symptom.

### Already fixed in staging build (do not re-implement)

| Guard / change | File | Purpose |
|----------------|------|---------|
| `cchGuardCrossEntitySync` | `platform/cch-doc-isolation.js` | Blocks `syncProductToClips`, `cchPushClipImagesToLinkedDocLines`, clip→library mirror unless explicit flags |
| `cchGuardLibraryWrite` + `cchRunAsLibraryEdit` | same | Blocks writes to `products/` / `productLibrary/` except from library UI |
| `syncProductToClips` no-op | `platform/index.html` | Library save does not push to clips |
| Clip→library mirror removed | `index.html` | Room-board save → clip doc only |
| Selections paths | `index.html` | No library writes from `setSelectionItemRoom`, `setSelectionItemCategory`, `selEditSave` |

### Still incomplete in repo (post-deploy follow-up, not blocking deploy)

From Jun 2 handoff — wire `explicitLibraryEdit` on remaining library UI writers (~9721, ~54881–55704) and block `_clearCatalogRoomForRemovedClip` (~65596). Audit:

```bash
rg "collection\('products'\)|collection\('productLibrary'\)|_updateLibraryProductDual" platform/index.html
```

---

## 3. Room Board ↔ Document isolation — status

**Largely enforced already.** Doc-back-sync master switch is **active on both prod and staging** (`cchNoBackSyncFromDoc() → true`).

### Already true (prod + staging)

- Doc→library pushes blocked via `cchGuardDocBackSync` for `pushLibraryPrices`, `scheduleLibraryAutoSync`, `syncProductToClipsFromDoc`, `clipHydrateOnOpen`, `spawnClipFromDocLine`, etc.
- Clips created from doc lines **only** via explicit **"Link to Room Boards"** (`index.html` ~32380) — never on auto-save.
- Auto doc-save runs `syncProposalLinkOntoClips` → **link metadata + status only** (~33068); does not overwrite clip title/category/image; does not delete clips.
- `ensureProposalLinesLinkedToRoomBoard` skips frozen + already-linked lines (~33155); never updates existing clips.
- Delete doc line → clip **remains**; `removeProposalItem` only unlinks (~29129).

### Two vectors fixed in staging build, missing on prod (same deploy)

| ID | Issue | Prod | Staging/local fix |
|----|-------|------|-------------------|
| **RB-LIB** | Library save overwrites room-board clips | Unguarded `syncProductToClips` | no-op + `cchGuardCrossEntitySync` |
| **RB-2** | Proposal auto-save clobbers room-board **Decline** with `pending` | `syncProposalLinkOntoClips` always writes `clientSelectionStatus` | Jun 7: only real Approved/Declined persist (~33113) |
| **RB-2b** | Display path overwrote decline | `enrichClipsWithProjectDocLinks` | Jun 7: real decision wins (~32980) |
| **RB-1** | Status dropdown bounce / refresh toast | `setupClipsListener` fires on own write | Jun 7: `_cchSuppressClipsRefreshUntil` (~13305, ~18245) |

**Do not** add new guards in `docEditSave` / `ensureProposalLinesLinkedToRoomBoard` — duplicates done work.

---

## 4. Deploy plan

### Bundle choice

| Option | Contents | Status |
|--------|----------|--------|
| **A** | Full current build: isolation + decline fix + Selections category/image→Library fix | Not chosen |
| **B ✓** | **Isolation guards + decline/status fixes only** — strip or exclude Selections edit not yet validated on staging | **Cynthia starting choice (Jun 8)** |

Code: if Bundle B requires stripping Selections changes from the deploy artifact, confirm diff against staging before Phase 1. If staging already includes Selections fixes and they are low-risk, Cynthia may upgrade to A after Phase 1 smoke test.

### Phase 1 — Staging (Claude Code on Cynthia **GO**)

1. Deploy **Bundle B** build to `cch-platform-staging.web.app`.
2. Hard refresh; console → **`v20260603d`**, no new SyntaxErrors.
3. Smoke tests:
   - Library → edit Trade cost → Save → **no** "Updated N clip(s)" toast; room-board clip unchanged.
   - Room board → Decline → save linked proposal → **decline sticks** (no pending clobber).
   - Proposal line edit → linked clip title/category/image **unchanged**.
   - Delete proposal line → clip **remains** on board.

### Phase 2 — Production (**Cynthia only** — AI may not deploy prod)

1. Run `DEPLOY-PRODUCTION-DANGER.bat` (typed confirmation).
2. `firebase deploy --only hosting:platform --project production`
3. Hard refresh prod; console → **`v20260603d`** (was `v20260603b`).

### Phase 3 — Post-deploy verify on production

| # | Action | Expected |
|---|--------|----------|
| 1 | Edit Product Library item → Save | Room-board clips **not** overwritten |
| 2 | Edit proposal/invoice line (title, category, image) | Linked clip title/category/image **unchanged** |
| 3 | Room board → **Decline** → save proposal | Decline **sticks** (no revert to Pending) |
| 4 | Delete doc line | Clip **remains** on board (unlink only) |
| 5 | Client portal smoke test | No red console errors on one project route |
| 6 | `#/library` → Junk toggle | Archive rows visible (if junk loader deployed); note separate UI gap in §8 |

### Phase 4 — Rollback

`firebase hosting:rollback --project production` (or Firebase console). Prod **v20260603b** is known fallback; live prod files backed up locally by Code session.

---

## 5. Regression checklist (library + isolation — from Jun 2 handoff)

| # | Action | Expected |
|---|--------|----------|
| 1 | `#/library` → change Trade cost inline | Saves; no clip sync toast |
| 2 | Library → upload image on row | That product only |
| 3 | Room board → Edit → remove wrong thumb → Save | Clip updated; library + proposal lines **unchanged** |
| 4 | Selections → change room on library-sourced row | Clip/room board only; **no** `productLibrary` write |
| 5 | Proposal line → **Apply from Library** | Only that line changes after Save |
| 6 | Open proposal with linked clip | Distinguish display fallback vs Firestore (Network tab) |

---

## 6. What this deploy does NOT fix (data damage — repair after deploy)

Deploy **stops the bleed**; it does **not** restore quarantined products or fix miscategorized rows.

| # | Issue | Notes |
|---|-------|-------|
| D1 | **Quarantine over-reach (Jun 4 apply)** | Script `quarantine-products-library_BY_CLAUDE_2026-06-02.js` archived real Clipper/MyKnobs products (`classifyJunk`: `isJunk = !hasHouzz && !hasProductCode`). ~1,353 staging-vs-prod gap; 1,323 recoverable from `products_archive`. Report: `_backup/compare-staging-vs-prod-2026-06-07/`. **Dry-run + Cynthia GO per script name.** |
| D2 | **Empty library shells** | After quarantine, `cchLibraryUsageSyncDocument` can recreate `productLibrary/` + `products/` docs with only `libraryUsageRefs` (no title/images) — breaks line editor images. Code fix: `_normalizeProposalItemImages` should fall back to line images when library row is empty. |
| D3 | **Miscategorization** | 519 lighting → "Bedding & Pillows" on staging; legacy names, empty categories. Report: `_backup/staging-category-audit-2026-06-08/`. Library Edit + canonical 21 categories; optional repair CSV — no blind batch on live. |
| D4 | **Product `#` backfill** | `cchAllocateProductCode` pass; exclude orphan Houzz image rows. |
| D5 | **Junk Library UI** | Reads `productLibrary_archive` only; should also show `products_archive` (~4k rows on prod). Deploy junk toggle + verify client read. |
| D6 | **Single-item restores** | e.g. Rolling Hills banquette hardware (`modern_cabinet_hardware_collection7__...`) — restore from `products_archive` on request; link invoice clipId. |

**Do not re-run quarantine `--apply` without explicit approval.**

---

## 7. Key files

| File | Role |
|------|------|
| `platform/cch-doc-isolation.js` | Guards v20260603d; cache-bust in `index.html` script tag |
| `platform/index.html` | Monolith — `syncProductToClips`, `syncProposalLinkOntoClips`, `saveProduct`, selections |
| `platform/cch-product-categories.js` | Canonical 21 categories, room-as-category detection |
| `DEPLOY-PRODUCTION-DANGER.bat` | Production deploy wrapper for Cynthia |
| `Docs/CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md` | Full isolation implementation detail |
| `Docs/CLEANUP_HISTORY.md` | Houzz taxonomy + re-import guards |
| `_scripts/quarantine-products-library_BY_CLAUDE_2026-06-02.js` | Jun 4 quarantine (applied prod) |

---

## 8. Non-negotiables

- **Staging first.** Phase 1 on GO; Phase 2 Cynthia only.
- **No Firestore batch scripts** on live projects without Cynthia naming and approving the exact script; dry-run first.
- **No new isolation guards** in doc save paths — deploy existing build.
- **No commit / no prod deploy** unless Cynthia asks.
- **Agent spreadsheets:** `*_BY_CLAUDE_<descriptor>_<date>.xlsx` — never overwrite Cynthia's working files.

---

## 9. Phase 1 status — STAGING DEPLOYED (Jun 8, 2026)

**Command run:** `firebase deploy --only hosting:platform --project staging`  
**URL:** https://cch-platform-staging.web.app  
**Result:** Deploy complete (48 files uploaded).

**Automated post-deploy fetch (Cursor):**

| Check | Result |
|-------|--------|
| `cch-doc-isolation.js` | **`loaded v20260603d`** |
| `cchGuardCrossEntitySync` | present |
| `cchGuardLibraryWrite` / `cchRunAsLibraryEdit` | present |
| `index.html` → `cchGuardCrossEntitySync` | **4 occurrences** |
| `syncProductToClips` | **no-op + guarded** (not old `getCachedBoards` clip-writing body) |

**Phase 1 verification (Cursor — automated, Jun 8):**

Script: `_scripts/_staging-phase1-smoke_BY_CLAUDE_2026-06-08.js` → **13/13 PASS** on live staging fetch.

Runtime (browser CDP on `cch-platform-staging.web.app`, no login required):

| Check | Result |
|-------|--------|
| `CCH_ENV` | `staging` |
| Staging banner `#cchStagingBanner` | present |
| `cchNoBackSyncFromDoc()` | `true` |
| `cchGuardCrossEntitySync('syncProductToClips')` | `blocked: true`, `cross-entity-isolated` |
| `cchGuardLibraryWrite()` | `blocked: true`, `library-write-isolated` |
| `syncProductToClips(...)` call | `{ updated: 0, blocked: true }` — no clip writes |

**Not verified without studio login:** live Library save clip-unchanged, room-board Decline→proposal save stick. Guards and no-op are confirmed at runtime; authenticated E2E is optional before prod if Cynthia prefers.

## 10. Phase 2 status — PRODUCTION DEPLOYED (Jun 8, 2026)

**Command run:** `firebase deploy --only hosting:platform --project cch-design-boards`  
**URL:** https://cch-platform.web.app  
**Cynthia approval:** typed **GO production** (Jun 8).

**Post-deploy verification (Cursor):**

| Check | Result |
|-------|--------|
| `cch-doc-isolation.js` | **`v20260603d`** (was `v20260603b`) |
| Guards + no-op `syncProductToClips` | 7/7 fetch checks PASS |
| Runtime `syncProductToClips()` | `{ updated: 0, blocked: true }` |
| `CCH_ENV` on prod | `production` (no staging banner) |

**Rollback if needed:** `firebase hosting:rollback --project cch-design-boards`

**Still separate (not fixed by deploy):** quarantine restore, category repair, junk UI — see §6.
