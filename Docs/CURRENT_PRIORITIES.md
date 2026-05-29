# CCH Studio — Current Priorities

**Last updated:** May 24, 2026 (Design Board regressions in progress on staging)
**Maintainer:** Cynthia Holloway

This file holds time-bound priorities. CLAUDE.md is canon and timeless — anything dated lives here.
Completed work moves to the "Recently Completed Work" table in `CLAUDE.md` (AI Session Rule #9).

---

## URGENT (deadline-driven)

1. **Houzz/Ivy CDN rescue — May 25 deadline.** The `ivy-uploads.s3-us-west-2.amazonaws.com` URLs die May 25.
   - 6,810 line-item references in Firestore (across products/, productLibrary/, clips, invoice items, PO items, proposal items)
   - 341 catalog rows in `products/` still pointing at Ivy
   - Rescue script: `scripts/rewrite-image-urls.js`
   - Verification: re-run `_scripts/audit-image-hosting.js` — `OTHER_AWS_S3` should drop to near zero
2. **Verify Firebase Storage backup of `houzz-products/`** (20,375 files / 9.97 GB) is preserved on Toshiba `D:\` before May 25.

## HIGH (active UI regressions)

3. **Design Board — restore Morpholio/Canva behaviors** (Cloud-Rolling-Hills Kitchen board `2kx9yYWTDG7oxFmp80um`):
   - Desktop drag-and-drop → canvas (Firebase Storage upload)
   - Room filter on left sidebar (`clip.room`, default from board `room` / board name)
   - Inspiration tab pull-in (`ideabooks` images via `_ibImageUrlFromEntry`)
   - **Status:** fix in `index.html` `openDesignBoard` — verify on staging before production

3b. **PO → Bill → Client Invoice variance workflow + Discrepancy Report** (Cynthia confirmed May 27, 2026). Replaces the Houzz workflow that forced staff to retro-edit POs when vendors added freight, breaking QB matching. New model: PO is immutable after Send; "Receive Final Bill" captures vendor actuals (PO + freight + tax + extras) as a separate billing record; variance gets auto-classified (shipping/tax/restocking/etc.) and routed to client invoice or marked absorbed. Per-project Discrepancies tab + firm-wide Discrepancy Report + dashboard widget. Profit-protection feature — currently invisible freight overages aren't being invoiced forward to clients. **Full spec: `cch-deploy/Docs/SPEC_PO_Bill_Variance_Workflow_v1.0.md`.** Implementation on staging first per AI Session Rule #8.

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
