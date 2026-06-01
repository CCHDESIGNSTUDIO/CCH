# CCH Studio — Current Priorities

**Last updated:** May 27, 2026 (rev — Claude added COS Agent spec)
**Maintainer:** Cynthia Holloway
**Last revised by:** Claude (May 27, 2026 — added item 3c Chief of Staff Agent v1.0 spec reference)

This file holds time-bound priorities. CLAUDE.md is canon and timeless — anything dated lives here.

---

## Recently completed (May 2026)

- **Houzz/Ivy CDN rescue** — Ivy S3 URLs migrated; images saved to Firebase Storage / stable URLs. No further Ivy rescue work unless audit finds stragglers.
- **Firestore rules Phase 1** — `/products` create/update requires `isAuth()` on **staging and production** (deployed May 28, 2026). See `STAGING-HOSTING-SETUP.md` for deploy commands.
- **PO → Bill → QB (bill-only)** — Studio PO + vendor bill + `pushBillToQB`; PO not pushed to QB. On production hosting + functions; verify end-to-end in QB when ready.

---

## URGENT (deadline-driven)

*(none — Ivy May 25 deadline closed)*

## HIGH (active UI regressions)

3. **Design Board — restore Morpholio/Canva behaviors** (Cloud-Rolling-Hills Kitchen board `2kx9yYWTDG7oxFmp80um`):
   - Desktop drag-and-drop → canvas (Firebase Storage upload)
   - Room filter on left sidebar (`clip.room`, default from board `room` / board name)
   - Inspiration tab pull-in (`ideabooks` images via `_ibImageUrlFromEntry`)
   - **Status:** fix in `index.html` `openDesignBoard` — verify on staging before production

3b. **PO → Bill → Client Invoice variance workflow + Discrepancy Report** (Cynthia confirmed May 27, 2026). Core bill-only path shipped (vendor bill → QB Bill, PO locked after send). **Remaining:** discrepancy tab/report/dashboard, client invoice routing from variance, spec sync (`SPEC_PO_Bill_Variance_Workflow_v1.0.md` still says no bill push to QB — update when reviewing AC).

3c. **Chief of Staff Agent v1.0** (Cynthia approved May 27, 2026 — "the dream COS who always says yes — done, when I ask"). Project expediter / design assistant AI layer on top of Studio. Watches data continuously, generates `attentionItems`, produces daily briefing modal + email, drafts vendor nudges, surfaces stale priorities. 6-8 Cursor sessions to v1.0 production. **Full spec: `Docs/SPEC_Chief_Of_Staff_Agent_v1.0.md`.** First win = daily briefing modal (Phases 1-3, ~3-4 sessions). The "BIG notification" work (item 3a) is the foundation for this — same `notifications` collection pattern.

3d. **CFO Agent v1.0** (Cynthia approved May 27, 2026 — "look at Studio and QB data"). Financial-intelligence specialization of COS pattern. Watches AR aging, AP balances, project margin, QB sync drift, monthly P&L. Uses existing `cch-finance-procurement` and `cch-intelligence-analytics` skills as knowledge base. **Full spec: `Docs/SPEC_CFO_Agent_v1.0.md`.** 6-8 Cursor sessions. Phase 1+2 (AR aging widget + daily cash snapshot) = ~2 sessions, highest immediate value.

3e. **CMO / Client Experience Agent v1.0** (Cynthia approved May 27, 2026 — "client experience and marketing CMO"). Client-relationship intelligence specialization. Watches client portal activity, communications cadence, inspirations engagement, design-review timing. Drafts (never sends) client emails per CCH brand voice. Uses existing `cch-ceo-coach`, `cch-marketing`, `cch-client-portal`, `elu-brand` skills. **Full spec: `Docs/SPEC_CMO_Agent_v1.0.md`.** 6-8 Cursor sessions. Phase 1+2 (silence detection + engagement scorecard) = ~2 sessions, highest immediate client-retention value.

3a. **BIG notification when items push to QuickBooks** (Cynthia requested May 27, 2026). Currently push-to-QB happens with no visible confirmation, so users can't tell if it worked without checking QB directly. Three-layer notification system:
   - **Modal (click-to-acknowledge)** on FIRST push of a doc — invoice or PO going to QB for the first time. Shows: doc number, amount, QB record ID, link to QB. Blocks UI until clicked OK. Prevents "did it work?" anxiety on new pushes.
   - **Full-width banner at top of screen** on subsequent SYNC events (status update, balance refresh, payment sync). Green for success, red for failure. Auto-dismiss after 8 seconds. Shows "PO-400082 synced to QB at 2:34 PM · balance $0".
   - **Sticky toast/card top-right** for stacked recent activity — shows last 3-5 QB events, persists until dismissed, click to expand details.
   - Hook into existing QB sync code paths: `qbWebhook`, `syncInvoiceBalanceFromQB`, `batchSyncInvoiceBalancesFromQB`, manual Push-to-QB button on invoice/PO edit.
   - Failure cases (QB token expired, schema mismatch, network error) get the same modal/banner with red styling + actionable error message.

## HIGH (architectural)

4. **Implement RESOLVE vs APPLY pattern** per AI Session Rule #3. Replace `applyLibraryImageSyncToDocItems`, `ensureLibraryProductsForLineItems`, `syncImageFromLibrary` — these are the auto-persist overwrite bug.
5. **Restore Product Library UI** lost in May 13 revert (commit `bc5175c`):
   - Houzz ID display in modal header
   - LINKED column with chain-icon popover
   - Three-column LINKED section in Edit dialog (Proposals / Invoices / POs)
6. **Re-add Replace Image button** on product edit modal. Must UPDATE existing doc, not CREATE a new product.
7. **Categories regression** — Design services and Expenses leaked back into Product Library type dropdown and Selections category dropdown. Filter out by `expenseType: 'service'` / `expenseType: 'expense'`.

## MEDIUM

**Triaged from feedbackRequests (March 2026 — sat untouched 60+ days, Claude moved to In Progress May 27):**

- **Client Searchbar cursor jump** (Vanessa, Mar 23) — same root cause as the known Search Selections cursor bug. Affects multiple search boxes. Fix at the input-handling layer, not per-page.
- **Smart Time Chrome time overcounting** (Cindy, Mar 25, Critical) — Campco showed 1.25hr for 14min of actual use. Likely capture-consolidation 30-min merge inflating idle gaps. Investigate `CCH-TimeAgent.ps1` aggregation + `index.html` capture rendering.
- **Smart Time list delete** (Cindy, Mar 24) — delete button missing/unwired in Smart Time list view. Same class as known "Delete Items from Boards" bug.
- **Activity Page rendering empty** (Cindy, Mar 20, Low) — possibly fixed in May 13 portal restoration. Needs prod verification.

7. Remove service/expense rows from Product Library (11 docs flagged Apr 29 in `_debug/phase1_5-remove-from-library.csv`).
8. Fix `Appliances  & Plumbing` double-space typo (14 docs).
9. Fix Tearsheets page (currently blank).
10. Connect product image slots 2-5 to products via `images[]` array — 9,579 orphaned files in `houzz-products/<houzzId>/{2..5}.<ext>` are uploaded but not referenced in Firestore.
11. Investigate Apr 29 save issue — the `_enrichedFromHouzzApr27` and `_categoryFixedAt` timestamp fields may be causing silent save failures.

## NICE-TO-HAVE

12. **Triple-DUP cleanup on Cloud-Rolling-Hills** (~1,043 duplicate clips — same SKU added 3x with different categories).
13. **Implement Display ID prefix system** (H-/S-/C-) per AI Session Rule #6. Currently future-state.
14. **Reconcile `products/` and `productLibrary/`** — pick canonical row per houzzId, migrate refs, eventually retire `productLibrary/`.
15. **Clipper ID format revision** — replace ugly slug `soapstone_kitchen_sinks__m_teixeira_soapstone__appliances___plumbing` with clean numeric `#`. Architecture: Clipper writes to Product Library FIRST, then routes to Project + Room.

---

## RULES FOR THIS FILE

- Dated header — update on every change.
- Items move out (completed → AI Session Rule #9 table in CLAUDE.md) or remain (active).
- New items go in MEDIUM by default; promote to HIGH/URGENT as needed.
- One file = one priority list. Don't fork.
