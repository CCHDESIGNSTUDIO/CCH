# CCH Product Swapping Bug — Consolidated Report

**File:** INTERNAL_PRODUCT_SWAP_BUG_CONSOLIDATED_BY_CR_Jun22_v1.0.md
**Original Author:** Cursor (CR)
**Created:** Jun 22, 2026
**Last Modified:** Jun 22, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.0

## Revision history

- v1.0 (Jun 22, 2026, CR): Initial. Consolidates Jun 19 product-library audit + grounded code paths for product/clip identity swapping.

---

## 1. Bug statement (plain English)

The "product swapping" bug is when a **room-board clip, proposal line, invoice line, or PO line** ends up linked to or displaying **another product's identity** — wrong thumbnail, vendor/SKU, notes, or `clipId`/`libraryProductId` — even though the line title/room still describe the intended item. A confirmed instance: on **Cloud - Rolling Hills**, **INV-6017 / PO-9036**, Guest 2 (Suite 2) and Guest 4 (Suite 4) both pointed at **Guest 3's shared Maverick clip** (wrong image + L43 notes) until each was given its own clip (`rhG2Maverick52L39` / `rhG4Maverick52L39`). The pattern also shows up as proposal lines sharing one `clipId`, orphan PRO/INV pills after deletes, and library rows that collide under duplicate `houzzId` or title-only matching.

---

## 2. Evidence table

| Audit / source | Key finding | Path |
|---|---|---|
| **SUMMARY.json** (authoritative) | 4,853 `products/` + 4,562 `productLibrary/`; **2,328 duplicate groups**, **2,447 rows to retire**; **72 project-connected dups** need reconnect; **105 clip refs + 101 doc-line refs** point at dup IDs; **128 orphan links**; 124 boards scanned | `C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Audits and Clean up data\PRODUCT_LIBRARY_AUDIT_2026-06-19\SUMMARY.json` |
| **01_overview.csv** | Same counts as SUMMARY; 106 zero-image products; 2,327 duplicated houzzIds within `products/` | `...\PRODUCT_LIBRARY_AUDIT_2026-06-19\01_overview.csv` |
| **02_duplicates_clip_refs.csv** | 105 clip→dup mappings; **Cloud - Rolling Hills dominates**; many dup IDs with blank titles map to keeper `LCmDNGhkRiMNO0dY4AqK`; titled dups show real keeper swaps (e.g. `r2DtpTXIANLrJlCOuqer` → `6EEMEvLJPnSAwiXLtVKy`) | `...\02_duplicates_clip_refs.csv` |
| **02_duplicates_doc_refs.csv** | 101 financial-doc lines referencing dup library IDs; **IN-12980, INV-6017, PRO-3025, PRO-3011, PO-9036** on Rolling Hills | `...\02_duplicates_doc_refs.csv` |
| **03_products_by_project.csv** | Per-project impact: **Rolling Hills** — 370 clips, 139 dup refs, **101 orphan refs**; Shimano 33 dup / 16 orphan; Holtz Hill 33 dup | `...\03_products_by_project.csv` |
| **04_orphan_links.csv** | 128 dangling `libraryProductId` refs (clipper slugs, deleted IDs, service SKUs); heavy on Rolling Hills + Bugletrail | `...\04_orphan_links.csv` |
| **PRODUCT_LIBRARY_FULL_AUDIT_BY_CLAUDE_2026-06-19.js** | Read-only audit script: keeper scoring by houzzId→sku→title\|vendor; scans clips + invoices/proposals/POs for dup/orphan refs | `...\PRODUCT_LIBRARY_FULL_AUDIT_BY_CLAUDE_2026-06-19.js` |
| **_probe_dedup_groupquality_2026-06-19.js** | Probe for **degenerate dedup groups** (blank houzzId/sku/title); not run in this session — output needed | `...\_probe_dedup_groupquality_2026-06-19.js` |
| **Prior session (Rolling Hills)** | PRO-3025 orphan tiles, shared `clipId` pairs, dead library IDs; proposal-open backfill + wrong `libraryProductId` cited | Agent transcript `3928f2fa-8e18-40d2-a544-f177c7bba0f8` |
| **Prior session (invoice re-sync)** | Title-only `clipsByTitle` matching caused cross-room thumbnail swaps (e.g. "Manhattan"); fix scoped to invoice-tagged clips only | Agent transcript `c6a97aa6-4d21-4792-a961-cc91aaed7c54` |
| **platform/index.html** | Explicit comment: proposal backfill **"never rewrite images (title-only match swapped wrong photos)"**; invoice open hydrate gated; `refreshDocumentLineImagesFromClips` still title-fallbacks | `C:\dev\CCH-Platform-Deploy\cch-deploy\platform\index.html` |

---

## 3. Root-cause hypotheses

### H1 — Title-only / fuzzy clip matching overwrites identity [GROUNDED `index.html:7834`, `7852`, `7927-7931`]

`backfillProposalLinesFromMatchingClips` resolves clips as `(lineCid && byId.get(lineCid)) || (nk ? byTitle.get(nk) : null)`. When `clipId` is missing, **normalized title alone** picks a clip; tie-break is **highest selling line total** (`7817-7821`), not room/vendor. Comment at `7852` documents wrong-photo swaps from this path. `refreshDocumentLineImagesFromClips` (`7927-7931`) falls back title+vendor, then **title-only**, and writes `imageUrl`/`images` to the doc.

### H2 — Duplicate `products/` rows + stale `libraryProductId` on clips/lines [GROUNDED `SUMMARY.json`, `02_duplicates_*.csv`]

2,328 duplicate groups (mostly shared `houzzId`). 105 clips + 101 doc lines still reference **retire-candidate** dup IDs. If UI/sync resolves library by ID without keeper remap, the wrong row's image/metadata can appear. Rolling Hills CSV shows many blank-title dupes converging on one keeper ID — **[UNVERIFIED]** whether that keeper is itself degenerate (probe script not executed this session).

### H3 — Orphan / slug library IDs [GROUNDED `SUMMARY.json` q3_orphans, `04_orphan_links.csv`]

128 links point at IDs in **neither** `products/` nor `productLibrary/` (clipper slug IDs like `clove_pendant_small__regina_andrew__lighting`, deleted Firestore docs). Fallback matchers may then attach an unrelated library row by title.

### H4 — Shared `clipId` across multiple financial lines [UNVERIFIED]

Rolling Hills session reported **2 pairs** of PRO-3025 lines sharing the same `clipId` (Maverick-style). Not re-verified in Firestore this session; consistent with observed Guest 2/4 → Guest 3 clip bug.

### H5 — Cross-entity library→clip sync [GROUNDED `index.html:55707-55721`] — likely **not** ongoing cause

`syncProductToClips` is **disabled by default** unless explicit user action. Reduces but does not eliminate swap risk from backfill/match helpers.

### H6 — Invoice open "Re-sync from clips" [GROUNDED `index.html:38976-38978`]

Previously used project-wide title map (documented as causing wrong thumbnails). Now **scoped to invoice-tagged clips only** and gated behind `cchAllowClipToDocHydrateOnOpen()`. Proposal paths in H1 may still be unsafe.

### H7 — Identity protection gaps [GROUNDED `index.html:10677-10685`, `10987-10993`]

`lineItemImageIsProtected` blocks image rewrite when `_imageLocked`, `_clipSourceTruth`, `_frozenAt`, etc. are set. Lines **without** those flags remain vulnerable to H1/H2. `cchDocLineIdentityIsFrozen` protects locked library links + protected images.

---

## 4. Scope / impact

| Metric | Count | Source |
|---|---|---|
| Duplicate product groups | **2,328** | SUMMARY.json |
| Rows to retire (self-dedup) | **2,447** | SUMMARY.json |
| Dups connected to projects (reconnect required) | **72** | SUMMARY.json |
| Safe to remove (no project link) | **2,375** | SUMMARY.json |
| Clip refs → dup IDs | **105** | SUMMARY.json |
| Doc line refs → dup IDs | **101** | SUMMARY.json |
| Orphan/dangling library links | **128** | SUMMARY.json |
| Boards with library links | **124**; 567 clip links, 286 doc links | SUMMARY.json |

**Highest-impact projects (from `03_products_by_project.csv`):**

- **Cloud - Rolling Hills** — 139 dup refs, 101 orphan refs (primary known swap theater; INV-6017, PO-9036, PRO-3025, IN-12980)
- **Shimano- Maverick Cir.** — 33 dup, 16 orphan
- **Holtz Hill** — 33 dup, 2 orphan
- **7225 Bugletrail** — 1 orphan (also in orphan CSV)

---

## 5. Phased fix plan

### Phase 0 — Read-only audit (safe now)

1. Run `_probe_dedup_groupquality_2026-06-19.js` — quantify **BLANK(no title)** mega-groups and validate keeper `LCmDNGhkRiMNO0dY4AqK`.
2. Re-run `PRODUCT_LIBRARY_FULL_AUDIT_BY_CLAUDE_2026-06-19.js` (dry-run) post any Rolling Hills manual fixes; diff CSVs.
3. **Rolling Hills spot audit:** export clips for Guest 2/3/4 Maverick + INV-6017 / PO-9036 lines; verify unique `clipId` per room line.
4. Scan proposals/invoices for **duplicate `clipId` within same doc** (grep/script; not done this session).

### Phase 1 — Data cleanup (**destructive — Cynthia approval required**)

1. **Reconnect 72 project-connected dup refs** using `02_duplicates_clip_refs.csv` + `02_duplicates_doc_refs.csv` keeper columns (`keeperId(reconnect to)`). Update `libraryProductId` / `linkedLibraryProductId` on clips and line items; never bulk-delete without per-row review.
2. **Retire 2,375 safe dup rows** only after reconnect pass; keep highest-scored keeper per group (audit script logic at `PRODUCT_LIBRARY_FULL_AUDIT...js:54-58`).
3. **Fix 128 orphan links:** per `04_orphan_links.csv`, either assign correct keeper ID, clear bad ID, or recreate missing library row — **no automatic title match**.
4. **Per-incident clip splits** (Maverick pattern): duplicate shared clip, assign room-specific `clipId` on each line, set `_clipSourceTruth` / `_imageLocked` on corrected lines.

### Phase 2 — Code hardening (**requires deploy approval**)

1. **Remove title-only fallback** in `backfillProposalLinesFromMatchingClips` (`7834`): require `clipId` match or explicit user "Link to Room Board" action; never `byTitle` alone. [GROUNDED need from `7852`]
2. **Tighten `refreshDocumentLineImagesFromClips`** (`7927-7931`): drop title-only fallback; require `clipId` or title+vendor+room; respect `lineItemImageIsProtected` / `cchDocLineIdentityIsFrozen` always.
3. **Keeper remap at read time:** when resolving `libraryProductId`, if ID ∈ retire set, resolve to canonical keeper before displaying (defense in depth until data clean).
4. **On doc save / link:** stamp `_clipSourceTruth` + `clipId` when user explicitly links; prevent silent re-match.
5. **Do not re-enable** `syncProductToClips` without room-scoped matching.

### Phase 3 — Verification

1. Re-run full audit; targets: **0 clip/doc refs to dup IDs**, orphan links trending to 0.
2. Manual QA on Rolling Hills INV-6017, PO-9036, PRO-3025: each guest-room line shows its own image/notes.
3. Open proposal → confirm backfill updates economics only, **never** `imageUrl`.

---

## 6. Open questions / budget gaps

- **`_probe_dedup_groupquality` output not captured** — size/quality of blank-title mega-groups unknown.
- **No live Firestore read this session** — shared-clipId counts for PRO-3025 unverified.
- **Keeper `LCmDNGhkRiMNO0dY4AqK`** appears in many blank-title rows; identity/title not inspected.
- **Other audit folders** under Houzz & QB beyond Jun 19 bundle not inventoried (budget cap).
- **`05_zero_image_products.csv`** not sampled — 106 zero-image products may worsen title-only matching.
- **Agent-produced fix scripts** for Rolling Hills exist in prior sessions; not listed/validated here.

---

## Top root-cause hypothesis

**Primary hypothesis:** product swapping is driven by **identity resolution that falls back to normalized title (or title+vendor) when `clipId` / canonical `libraryProductId` is missing or points at a duplicate/orphan row**, causing a line or clip to inherit another item's image and metadata. This is **explicitly acknowledged in code** at `index.html:7852` for proposal backfill, and still present in `refreshDocumentLineImagesFromClips` (`7927-7931`). The Jun 19 audit adds a **data layer**: 2,328 duplicate groups and 128 orphan links mean many live refs already point at the wrong Firestore doc before any matcher runs.

**First recommended step:** run the read-only **`_probe_dedup_groupquality_2026-06-19.js`** and a **Rolling Hills spot export** for INV-6017 / PO-9036 / Guest 2–4 clips to confirm whether bad `libraryProductId`/shared `clipId` or title-fallback code is the active mechanism on that project — then gate any reconnect writes on Cynthia's approval using the existing `02_duplicates_*.csv` keeper columns.
