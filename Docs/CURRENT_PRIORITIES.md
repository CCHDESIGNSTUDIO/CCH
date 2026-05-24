# CCH Studio — Current Priorities

**Last updated:** May 24, 2026
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

## HIGH (architectural)

3. **Implement RESOLVE vs APPLY pattern** per AI Session Rule #3. Replace `applyLibraryImageSyncToDocItems`, `ensureLibraryProductsForLineItems`, `syncImageFromLibrary` — these are the auto-persist overwrite bug.
4. **Restore Product Library UI** lost in May 13 revert (commit `bc5175c`):
   - Houzz ID display in modal header
   - LINKED column with chain-icon popover
   - Three-column LINKED section in Edit dialog (Proposals / Invoices / POs)
5. **Re-add Replace Image button** on product edit modal. Must UPDATE existing doc, not CREATE a new product.
6. **Categories regression** — Design services and Expenses leaked back into Product Library type dropdown and Selections category dropdown. Filter out by `expenseType: 'service'` / `expenseType: 'expense'`.

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
