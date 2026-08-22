# CCH Studio — Known Issues

**Last updated:** August 19, 2026  
**Maintainer:** Cynthia Holloway  
**Last revised by:** Claude (Aug 19, 2026 — CLIP-3 DATA LOSS: finish select wipes clip, no save prompt)

Tracked regressions and open bugs. For prioritized work order see `CURRENT_PRIORITIES.md`.

---

## Design Board (regressions — May 24, 2026)

| # | Issue | Expected behavior | Test URL / notes |
|---|--------|-------------------|------------------|
| DB-1 | Desktop drag-and-drop to canvas | Drop image files from desktop onto canvas; uploads to Storage, adds element | `/project/cloud-rolling-hills/designboard/2kx9yYWTDG7oxFmp80um` |
| DB-2 | Room filter missing | Left sidebar **Room** dropdown filters room-board clips by `clip.room`; defaults from board `room` or board name (e.g. Kitchen) | Same |
| DB-3 | Inspiration pull-in empty | **Inspiration** tab lists project `ideabooks` images (not only legacy URL fields) | Same |

**Fix location:** `platform/index.html` → `openDesignBoard()`.

---

## Room Board (regression — June 7, 2026)

| # | Issue | Expected behavior | Notes |
|---|--------|-------------------|-------|
| RB-1 | Changing a clip's client-selection status on the Room Board (e.g. **Decline**) pops a `🔄 New clips detected — refreshing…` toast and full-re-renders the page, resetting the dropdown so the change appears not to take. Reported by Cynthia on **production** after the v20260603d deploys. | Status saves quietly: no refresh toast, dropdown keeps its value, view/scroll does not reset. | **Root cause (grounded Jun 7):** `setClipApprovalStatus()` writes `clientSelectionStatus` to `boards/{proj}/clips/{id}` (`index.html:18179`); that write trips the real-time clips `onSnapshot` listener `setupClipsListener()` (CLR-02, `index.html:13300-13310`), which can't distinguish the user's own write from an external one → toast (`13307`) + `renderProjectDetail()`. The decline **does** persist on the clip (`getClipApprovalStatus` reads the same field, `18088`) — defect is the disruptive refresh, not the save. **Possible compounding:** console also shows `SyntaxError: Unexpected end of input` + `[renderBoardsTab] projectTabContent missing` (not yet grounded). **Fix location:** `setupClipsListener` (~13297) — skip self-writes via `snapshot.metadata.hasPendingWrites` / `docChanges()`, or a local-write suppression window around `setClipApprovalStatus`. Staging first. **STATUS (Jun 7):** Fixed via `_cchSuppressClipsRefreshUntil` window set in `setClipApprovalStatus` (`18184`) + early-return in `setupClipsListener` (`13303`). Deployed to staging; awaiting Cynthia test → prod. |
| RB-2 | Approve/Decline does not sync between the Room Board and the linked Proposal/Invoice line. Declining a **proposal-linked** clip (PR-pill card) on the room-board dropdown does **not** stick — it reverts on render. Cynthia wants it bidirectional: decline on room board → declined on proposal; decline on proposal → declined on room board. | One client decision, consistent on both surfaces, whichever surface it was set from. | **Root cause (grounded Jun 7):** the proposal/invoice line (`lineApprovalStatus`) is **already the source of truth**. `enrichClipsWithProjectDocLinks()` RESOLVES it onto `clip.clientSelectionStatus` in memory on every render (`index.html:32918-32919`, read-only scan, `persistToClips:false`, called at `18557`). So proposal→room-board already works for display. The missing half: `setClipApprovalStatus()` (`18174`) writes **only the clip**, never the proposal line → room-board→proposal never happens, and the next render overwrites the clip from the (still-pending) proposal line. **Correct fix per AI Session Rule #3 (RESOLVE/APPLY):** for a proposal-linked clip, the room-board dropdown should **APPLY** the status to the proposal line `lineApprovalStatus` (the source of truth) on explicit user action; display already RESOLVES back. **Do NOT** implement as a second mirrored field / two-way auto-copy — that dual-write is the drift class the isolation work just removed. Cross-entity write must be gated as explicit user action only. **Depends on RB-1** (listener self-refresh) being fixed first. **STATUS (Jun 7):** Root fix deployed to staging — a `pending` line can no longer overwrite an explicit clip approve/decline, in BOTH the DB writer `syncProposalLinkOntoClips` (`33042`) and the on-render resolver `applyLink` (`32919`). Only real `approved`/`declined` decisions flow line→clip. This stops the "decline won't stick" wipe for all docs/projects automatically (no archiving). Full room-board→proposal write-back intentionally **deferred** per Cynthia (no bidirectional sync). Sibling behavior **confirmed intended** by Cynthia (Jun 7): deleting a line from a proposal leaves the clip on the room board showing **pending** — no change (`29070`). |
| RB-3 | Room board 🗑 labeled "Remove from room board" but called `deleteClip()` — permanently deleted the Firestore clip, so the row vanished from Selections too. Reported Jul 6 (Holtz + other projects). | Trash on room board clears `room` only; clip stays in Selections (Unassigned on room board). Permanent delete only from clip detail modal or Selections delete. | **Root cause (grounded Jul 6):** room board card + list trash wired to `deleteClip` which deletes `boards/{proj}/clips/{id}`; Selections builds from those clip docs first (`source: 'boardclip'`). **Fix (Jul 6):** `removeClipFromRoomBoard()` clears clip `room` + `_clearCatalogRoomForRemovedClip`; trash wired there (~19820 card, ~20272 list); `deleteClip` kept for clip detail and Selections permanent delete. **STATUS:** **done** — staging 2026-07-06 12:30; **production 2026-07-06 ~13:45** (v9.8.19 bundle). |

## Selections page (regression — June 7, 2026)

| # | Issue | Expected behavior | Notes |
|---|--------|-------------------|-------|
| SEL-1 | On the Selections page, editing **Category** (inline dropdown) or any field via the **Edit modal** (incl. **image**) shows a success toast but does **not** persist for **library / products / Houzz-sourced** rows; reverts on reload. Reported by Cynthia Jun 7 on Cloud-Rolling-Hills. | Edit persists (or UI clearly states where to edit). | **Root cause (grounded Jun 7):** `setSelectionItemCategory` (`15550`) and `selEditSave` (`15351`) only write when `item.source === 'boardclip' && _clipDocId`; all other sources hit a no-op `else` (in-memory only) yet still fire "✅ Item updated". The isolation pass removed the old selection→library write (`15366`) and left **no replacement**. Selections merge `source:'library'` from `productLibrary/` (`14299`) + `products/` (`14314`) — category/image live on the catalog doc. **Precedent:** `setSelectionItemRoom` (`15435`) find-or-creates a clip for library rows. **Decision pending (Cynthia):** (a) explicit library APPLY via `explicitLibraryEdit` — edits canonical product, sticks everywhere; (b) find-or-create clip — project-scoped, creates a room-board clip; (c) read-only here, edit in `#/library`. **Also seen:** category rendering as concatenated `LightingBedding & Pillows` — polluted stored value or `_selCategoryOptionsHtml` defect; investigate separately. |

## Financial documents — product field propagation (June 9, 2026)

| # | Issue | Expected behavior | Notes |
|---|--------|-------------------|-------|
| DOC-1 | **SKU / finish missing on new proposal, invoice, and PO lines** even when the same item shows full data in Project Selections (clip + library). Reported Jun 9 on Cloud-Rolling-Hills PO lines (e.g. Visual Comfort sconces). | New doc lines copy **sku** and **finish** from the room-board clip or catalog row at add time; PO inherits them from proposal/invoice source lines. | **Root cause:** doc lines are snapshots; several create paths (`generateProposalFromClips`, library→proposal, pick-from-selections, pull room board) copied pricing + ids but omitted `sku` / `finish`. Selections **edit** reads live from Firestore — data was never missing on the clip. **STATUS (Jun 9):** Partial fix in `index.html` — `cchStampLineFromProjectClip`, `generateProposalFromClips`, `createProposalFromSelectedLibrary`, `libraryRailAppendAllRoomBoardClips`, `docEditPickFromSelections`, `addDocMyItem`. **Verify on staging** before prod. Does **not** backfill existing lines. |
| F-131 | **Full catalog payload propagation** (library → selections → proposal → invoice → PO): dimensions, materials, descriptions, spec URLs, gallery, etc. — not only sku/finish. | One product story; explicit RESOLVE for display, APPLY on user action; no backward sync into library. | **Deferred** until Product Library / `products/` cleanup (houzzId dedup, collection unification). See `CURRENT_PRIORITIES.md` item 14 + new note Jun 9. Related: isolation guards (`cch-doc-isolation.js`), RESOLVE/APPLY priority item 4. |

---

## Design surfaces / client-ready workflow (intake — June 5, 2026)

Logged by Claude Code to production `feedbackRequests` and `CCH_Feature_Bug_Tracker.html`. **Bundle candidate:** Room Board UX sprint (D89, D90, D91, D92, O259) — shared modal layer + `boards/{}/clips/{}` + visibility patterns.

| # | Issue | Expected behavior | Notes |
|---|--------|-------------------|-------|
| D89 | Hide individual items on a room board | Per-item toggle: internal team sees item; client portal does not. For items not yet client-ready. | `visibleToClient` on clip; eye icon in context menu; greyed internal style. Mirrors CP98. |
| D90 | Hide / unpublish entire room board | Draft boards invisible to clients until published. | `publishStatus` draft \| published \| archived on board doc; header toggle. Distinct from D89. |
| D91 | Room board drag-drop reorder | Designer controls clip order on room board grid. | `sortIndex`/`position` on `boards/{}/clips/{}`; HTML5 DnD. Cross-ref tracker **F152** (regression). Pairs with P57 doc line reorder. |
| D92 | Gallery thumbnails too small; no zoom; delete × unclickable | Bigger thumbs, always-visible delete, click-to-expand lightbox. | **Bug+feature.** `pe-gallery-item` inline styles at `index.html` ~54945–54964: 56×56 thumbs, 18×18 hover-only ×. **Three modals:** room board item edit, Product Library edit, clip edit — **one fix**. Target: 96–120px thumbs, 28×28 delete, expand icon → lightbox. feedbackRequests `yGqoKBUpiXWFKXFHPg7y`. |
| P63 | Save/email navigation drift (invoices, proposals, POs) | After Save or Send Email, stay on the **same document** in viewable mode. | Bug. Save handlers re-navigate via `renderProjectDetail()` / hash and lose doc context. |
| P64 | Default landing = viewable view (not edit) | Opening any invoice/proposal/PO lands in client/PO read-only view; Edit is explicit. | Vanessa workflow. List clicks, deep links, post-save, refresh. |
| P65 | QB push popup on Sent doc landing | Nudge to push when status=Sent and not qbSynced. | Modal on viewable landing + yellow “Not synced to QB” banner until pushed. CURRENT_PRIORITIES item 3a. |
| CP106 | Image in Quick Note (Communications) | Paste or drag image into Quick Note; uploads to Storage; inline in team + client comms. | Quick Note text-only; data URLs blocked ~67530. Pairs with CP107. |
| CP107 | Lightweight approval on Quick Note | Approve / Reject / Comment on image notes in client portal. | Lighter than Log Correspondence → Approval flow. Depends on CP106. |
| O259 | Clipper “More details” header bigger | Vendor/SKU fields easier to see in Clipper sidebar. | `cch-clipper/.../sidebar.js` ~849; increase fold header size/padding; clearer chevron. |

---

## Pepper / notes (incident — August 2, 2026)

| # | Issue | Expected behavior | Notes |
|---|--------|-------------------|-------|
| PEPPER-1 | Pepper chat is never saved to Firestore. Aug 2: agents **crashed Cindy’s computer** (she did not switch projects); session death wiped Rolling Hills Pepper notes. | Pepper should persist per-project chat so a crash does not erase her working memory; agents must not thrash the machine. | **Grounded:** chat is DOM-only (`cch-pepper.js` `clearChat`). Incident: `Docs/INCIDENT_notes_loss_Rolling_Hills_Pepper_2026-08-02.md`. Standing memory in `Functions/cchPepper.js`. Persistence = feature (needs Cindy GO). |

## Other known issues

See `CURRENT_PRIORITIES.md` (Tearsheets blank, Product Library UI, RESOLVE/APPLY, Ivy CDN May 25, etc.).

---

## RULES FOR THIS FILE

- Add a row when a regression is confirmed; remove or mark fixed after staging verification.
- Link to `CURRENT_PRIORITIES.md` for scheduling, not duplicate priority ordering here.

---

## Clips / Selections — Aug 19, 2026

| # | Issue | Root cause (grounded) | State |
|---|--------|----------------------|-------|
| CLIP-1 | Saved proposal lines produce **no clips** — Selections shows nothing. Reported by Cynthia on **PRO-3024**, Aug 19. | `cchRunDocLineClipEnsureAfterSave()` at `platform/index.html:13954` sets `var dry = !cchDocLineClipEnsureWritesEnabled();`. The gate at `13485` returns `true` only when env is staging, else `return false`. On **production the ensure runs dryRun:true and `persistLineLinks:false`** — it computes what it would create and creates nothing. | OPEN — this is board Decision #2 (WO-113 Part 2 / WO-045 durability), gate default-OFF since Jul 27. Needs Cynthia's GO to enable prod writes. |
| CLIP-2 | Costs reported missing alongside CLIP-1 on PRO-3024. | **Not yet grounded.** Candidates: clip pricing backfill never applying markup ($0 cost + $0 clientPrice), and the copy-to-room carry that writes price as 0. Must confirm whether costs are absent on the proposal doc itself or only in the Selections view. | OPEN — needs one diagnostic from Cynthia |

**Not caused by the 9.9.227 deploy.** The Aug 18 production delta was 52 lines in `index.html` + 17 in `client.html`, none of which touch clip, cost, or selections code (verified by diffing the pre-deploy production file against local).

---

## 🔴 CLIP-3 — ACTIVE DATA LOSS — Aug 19, 2026

**Reported by Cynthia, Aug 19:** selecting a different **finish** wipes the entire clip, with **no prompt to save first**.

**Severity: highest open item.** This destroys work in progress with no confirmation step and no undo. Unlike CLIP-1 (clips not created — nothing lost) this loses data the user already entered.

**Status: NOT root-caused.** Do not attempt a fix until the exact surface is identified — there are at least four finish-bearing code paths and picking the wrong one risks another regression:

| Location | What it is |
|---|---|
| `platform/index.html:39589` | doc-edit line **Finish** text input → `docEditFieldChange(this)` |
| `platform/index.html:64913, 65306, 65370, 67074, 67080` | library product **finishOptions** picker |
| `platform/index.html:12918, 15122, 35096, 35971, 82220, 82276` | assorted `.finish =` assignments (copy / import / print paths) |

**Ruled out:** `_libraryFinishSave()` at `64240` — it only closes the modal and re-renders (`showProductDetail` / `renderLibraryView`). No writes, no deletes. Not the wipe.

**Related:** `selDupKeyForItem()` at `18118` has **no finish component** — key precedence is `lib:` id → `url:` → `title|vendor`. Same product URL in two finishes collapses to one key. Whether that dedupe is what "wipes" the clip is **unconfirmed**.

**Next step:** need the exact screen + control from Cynthia before touching code. Any fix requires a dry-run and typed GO (Rule 7).

### CLIP-3 root cause — CONFIRMED Aug 19 (Cynthia + code)

**Cynthia's domain facts:** the vendor URL is **identical for every finish** (finish is chosen on the page, not in the link), and **every finish has its own SKU**.

**Therefore:** URL can never distinguish finishes. SKU is the only discriminator that exists.

**The defect:** `selDupKeyForItem()` at `platform/index.html:18118` keys in this order —
`lib:<libraryProductId>` → `url:<normalized url>` → `title|vendor`.
**SKU is not in the key.** Verified: `sku` occurs 173× in `index.html`, and in **zero** dedupe/match expressions.

So two clips of the same product in different finishes produce an identical key → treated as the same product → the second overwrites the first.

**Fix direction (needs spec + Cynthia GO, do not code blind):**
1. Put **SKU ahead of URL** in the key: if two items have different non-empty SKUs, they are different products, full stop.
2. Only fall back to URL / title|vendor when SKU is absent on both.
3. Add the confirm step Cynthia asked for: "This product exists — update it, or add as a new finish?"
4. ⚠️ Changing this key changes what the Selections merge treats as duplicate **firm-wide**. Dry-run the split count before shipping anywhere.

**Still unconfirmed:** whether the collapse is display-time (rows hidden, data intact) or write-time (data overwritten). `selDupKeyForItem` sits in the SELECTIONS TAB block, which suggests display. If display-only, Cynthia's five re-clips are still in Firestore. `_scripts/inspect-pro3024-costs_BY_CLAUDE_2026-08-19.js` answers this — it prints every line with its computed key.

**Both mechanisms are live (corrected Aug 19):** the vendor URL **does** vary by finish. But `cchNormalizeProductUrlForDedup` (`27630`) sets `u.search = ''`, discarding the query string — so when a vendor encodes the finish as `?finish=…` / `?variant=…`, two genuinely different URLs normalize to one identical key. If the vendor encodes finish in the **path** instead, the URL key survives and the collapse comes from elsewhere.

**Why SKU is still the fix, not the normalizer:** preserving query strings would repair only the vendors who use them, and would wrongly split URLs that carry tracking params (`?utm_source=…`). SKU is vendor-independent and Cynthia confirms it is unique per finish. Key on SKU first; treat URL as a fallback only.

---

## 🔴 MONEY-1 — 5,375 documents store money as unparseable strings (Aug 19, 2026)

**Found by Claude, Aug 19, while chasing CLIP-2.** Scanned 19,879 documents across all board `clips` subcollections plus `products` and `productLibrary`.

**5,375 documents hold at least one money field as a `$`-prefixed string** (e.g. `cost = "$1985.00"`). `parseFloat("$1985.00")` is `NaN`, and every consumer coerces that to `0` — so the value is present in Firestore and reads as zero in every total, margin, report and export.

| Field | `$`-string | number | empty |
|---|---|---|---|
| `clientPrice` | **5,039** | 8,226 | 1,285 |
| `cost` | **1,586** | 11,726 | 4,830 |
| `retailPrice` | 1 | 190 | 376 |

**Worst boards:** park-city 2,009 · shimano-westridge-lane 1,134 · katke-puerto-vallarta 585 · cloud-mustang 430 · cch 330 · johnny 296 · cloud-huntington-beach 246 · katke-graceland-dr 182 · bradbury-high-drive 145.

**Fix:** strip `$` and `,`, parse to Number, write back. Dry-run manifest → diff → typed GO (Rule 7). Preserve any value that fails to parse rather than zeroing it.

**Scope note:** this is **NOT** the cause of the Aug 19 Rolling Hills hardware cost loss — cloud-rolling-hills has only 7 affected documents, and Cynthia's missing hardware costs are `null`, not strings. Separate defect, tracked as CLIP-2.

**Repro script:** `_scripts/count-string-costs_BY_CLAUDE_2026-08-19.js` (read-only).
