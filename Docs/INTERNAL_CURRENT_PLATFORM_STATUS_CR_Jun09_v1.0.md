# CCH Studio — Current Platform Status

**File:** INTERNAL_CURRENT_PLATFORM_STATUS_CR_Jun09_v1.0.md
**Original Author:** Cursor (CR)
**Created:** June 9, 2026
**Last Modified:** June 9, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.0
**Status:** DRAFT — pending review with Lead Cursor Agent before any archive/cleanup action is taken.

## Revision history

- v1.0 (Jun 9, 2026, CR): Initial. Stable-platform snapshot + operating standard, per Cynthia's cleanup initiative. No files moved or archived yet — this doc is the review artifact.

---

## What this file is

A single orientation page for the **stable platform as of June 2026**. It points to the canon docs instead of duplicating them. When this doc and a canon doc disagree, the canon doc wins.

| Question | Authoritative source |
|----------|---------------------|
| Standing rules, identity, deploy commands | `cch-deploy/CLAUDE.md` |
| Isolation model + guards + remaining work | `Docs/CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md` |
| Open bugs / regressions | `Docs/KNOWN_ISSUES.md` |
| Work order / priorities | `Docs/CURRENT_PRIORITIES.md` (one priority list — do not fork) |
| Houzz taxonomy + re-import guards | `Docs/CLEANUP_HISTORY.md` |

---

## What is actively maintained (live platform)

- `platform/index.html` — the single-file monolith (~70,300 lines). Never split. Targeted edits only.
- `platform/cch-doc-isolation.js` — isolation guards (`cchGuardCrossEntitySync`, `cchGuardLibraryWrite`, `cchRunAsLibraryEdit`). Mandatory. On-load console check: `[cch-doc-isolation] loaded v20260603d`.
- `platform/cch-product-categories.js` — canonical 21 FFE categories, `cchStringLooksLikePhysicalRoom`, `cchCategoryIsProtected`.
- `Functions/` — Cloud Functions (QB sync, `pushBillToQB`, webhooks).
- `cch-clipper-extension/` — Clipper capture.
- `_scripts/` — **active** operational scripts only (dated, `_BY_CLAUDE_*` named, dry-run-first). June 8–9 staging dedup / cost-fill / ivy-cutover work lives here and is current.

## Deploy targets (grounded in `.firebaserc`, Jun 9 2026)

- **Default = STAGING.** Bare `firebase deploy` goes to Firebase project `cch-studio-staging` (hosting site `cch-platform-staging.web.app`). The two names refer to the same staging environment: project vs hosting site.
- **Production** = project `cch-design-boards`, hosting site `cch-platform.web.app`. CLIENT-FACING. AI agents may not deploy to production. A production write requires Cynthia to explicitly type GO/YES.

## Old problems that are fixed (do not re-introduce)

Sourced from the isolation handoff and KNOWN_ISSUES (Jun 2026):

- **Backward sync into Product Library removed** — `syncProductToClips` no-op'd; clip→library mirror removed; clip→doc image push gated; Selections no longer write to library.
- **Library writes guarded** — all writes go through `_updateLibraryProductDual` / `cchRunAsLibraryEdit`; direct writes are the bug class, not the pattern.
- **Quarantine applied (Jun 4, 2026)** — 5,564 junk rows moved to `products_archive` / `productLibrary_archive` on production, with backup plan in `_backup/products-library-quarantine-2026-06-02/`. Do not re-run `--apply` without explicit approval.
- **Ivy CDN rescue (May 2026)** — images migrated to Firebase Storage / stable URLs.
- **RB-1 / RB-2** (room-board refresh toast; pending-line overwriting explicit approve/decline) — fixed on staging Jun 7, awaiting Cynthia's prod sign-off. See KNOWN_ISSUES.

## Script landscape (counted Jun 9, 2026 — pre-archive)

| Location | Count | Disposition (proposed, NOT executed) |
|----------|-------|--------------------------------------|
| `cch-deploy/` root loose `.js` | 29 | Legacy patch-era (`fix.js`, `allpatches.js`, `apply-*.js`…) — archive candidates |
| `_debug/` | 604 | One-off probes/repairs (Holtz, Parker, RH, QB) — archive candidates |
| `_scripts/` | 134 | **Mixed** — keep-list required; Jun 8–9 files are active work |
| `scripts/` | 3 | Review individually |
| `_backup/` | — | **Never move.** Recovery data (quarantine backup plan) |
| `_archive/` | does not exist yet | To be created only after Lead Cursor Agent review + Cynthia approval of the exact move list |

No file has been moved, renamed, or deleted as of this doc's creation.

---

## How to Keep the Platform Clean Going Forward

**Rule of One:**
Never run another one-off repair script directly on production data.
All data changes must go through a dry-run → manifest review → pilot on one small board → full apply process.

**Core Rules (never break these):**

- Room Board = client options area (multiple choices OK)
- Proposal / Invoice / PO = isolated snapshots — no back-sync to Room Board or Product Library
- Deleting from a document never deletes from Room Board
- Product Library saves and Room Board clip saves never overwrite images, category, or vendor on existing clips/docs
- Document isolation (`cch-doc-isolation.js`) is mandatory

**Development Rules:**

- All new work goes to staging first (`cch-studio-staging`)
- Test on staging, get approval, then deploy to production
- Only small, targeted changes to `platform/index.html` and active `_scripts/`
- Any new script must be named clearly (e.g. `apply-houzz-gallery-to-products.js`) and live in `_scripts/`
- Old one-off scripts stay in `_archive/2026-06-old-scripts/` — never run them again

**When in doubt:**

- Ask: "Does this change respect the isolation rules?"
- If the answer is unclear → do not run it.

This is now the official operating standard for CCH Studio.
