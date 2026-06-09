# CCH Studio — Known Issues

**Last updated:** June 8, 2026  
**Maintainer:** Cynthia Holloway  
**Last revised by:** Cursor (CR) (Jun 8, 2026 — §4 Claude/Code Jun 5 intake synced to tracker; RB-1/RB-2/SEL-1 unchanged)

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

## Selections page (regression — June 7, 2026)

| # | Issue | Expected behavior | Notes |
|---|--------|-------------------|-------|
| SEL-1 | On the Selections page, editing **Category** (inline dropdown) or any field via the **Edit modal** (incl. **image**) shows a success toast but does **not** persist for **library / products / Houzz-sourced** rows; reverts on reload. Reported by Cynthia Jun 7 on Cloud-Rolling-Hills. | Edit persists (or UI clearly states where to edit). | **Root cause (grounded Jun 7):** `setSelectionItemCategory` (`15550`) and `selEditSave` (`15351`) only write when `item.source === 'boardclip' && _clipDocId`; all other sources hit a no-op `else` (in-memory only) yet still fire "✅ Item updated". The isolation pass removed the old selection→library write (`15366`) and left **no replacement**. Selections merge `source:'library'` from `productLibrary/` (`14299`) + `products/` (`14314`) — category/image live on the catalog doc. **Precedent:** `setSelectionItemRoom` (`15435`) find-or-creates a clip for library rows. **Decision pending (Cynthia):** (a) explicit library APPLY via `explicitLibraryEdit` — edits canonical product, sticks everywhere; (b) find-or-create clip — project-scoped, creates a room-board clip; (c) read-only here, edit in `#/library`. **Also seen:** category rendering as concatenated `LightingBedding & Pillows` — polluted stored value or `_selCategoryOptionsHtml` defect; investigate separately. |

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

## Other known issues

See `CURRENT_PRIORITIES.md` (Tearsheets blank, Product Library UI, RESOLVE/APPLY, Ivy CDN May 25, etc.).

---

## RULES FOR THIS FILE

- Add a row when a regression is confirmed; remove or mark fixed after staging verification.
- Link to `CURRENT_PRIORITIES.md` for scheduling, not duplicate priority ordering here.
