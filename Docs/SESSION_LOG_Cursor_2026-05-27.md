# Session Log — Cursor: Cloud Invoice Dedupe, Portal Readiness, Tracker Compare

**File:** SESSION_LOG_Cursor_2026-05-27.md  
**Original Author:** Cursor (CR)  
**Created:** May 27, 2026  
**Last Modified:** May 27, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0  

**Workspace:** `CCH-Platform-Deploy`  
**Primary paths:** `cch-deploy/_debug/fix-dup-merge-lines.js`, `cch-deploy/_debug/hb-tracker-vs-studio-after-merge.js`, `cch-deploy/_debug/cloud-portal-readiness.js`  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  
**Cursor transcript:** [Cloud HB dupes / portal](0989d38a-2878-4ac4-8745-b44ab102d3fe)

## Revision history

- v1.0 (May 27, 2026, CR): Cloud duplicate invoice merge applied (HB, Parker, Mustang). Portal readiness audit. Tracker spot-check vs May 26 HB project tracker. User to finish IN-12905 payment and add IN-12975. Next project: Katke Graceland.

---

## Session overview

Cynthia needed **Cloud (Ron & Tracey) client portal** shareable without duplicate invoice rows, wrong balances, and hidden line items on the wrong Firestore doc. Work was **production Firestore only** (Admin SDK scripts), not `index.html` deploy.

**Root cause (grounded):** Houzz import created **`in-*`** docs with lines; legacy **`IN-*`** shells held Houzz-accurate totals/payments. Studio **Invoices tab hid** duplicates via `seenNums`; **client portal loads every invoice doc** with no dedupe — so Parker/Mustang would show duplicate numbers until Firestore was cleaned.

---

## What was applied (production)

Script: `cch-deploy/_debug/fix-dup-merge-lines.js`  
Flags: `--apply --backup`

| Board | Docs before | Docs after | Dup groups merged | Backup |
|-------|------------:|-----------:|------------------:|--------|
| `cloud-huntington-beach` | 68 | **42** | 26 | `_backup/cloud-huntington-beach-2026-05-27/invoices-pre-dup-merge.json` |
| `cloud-parker` | 224 | **114** | 110 | `_backup/cloud-parker-2026-05-27/invoices-pre-dup-merge.json` |
| `cloud-mustang` | 118 | **75** | 43 | `_backup/cloud-mustang-2026-05-27/invoices-pre-dup-merge.json` |

**Per duplicate pair:** KEEP `in-*` (most lines), MERGE payments/total/qbDocId/tags from `IN-*` shell, DELETE shell.

**Already clean (no apply this session):** `cloud-susan` (9), `cloud-rolling-hills` (36) — 0 duplicate pairs.

**Verify command:**

```bash
cd cch-deploy/_debug
node prod-board-dup-pattern.js
node cloud-portal-readiness.js
```

---

## User follow-ups (manual — not done by agent)

| Item | Project | Action |
|------|---------|--------|
| **IN-12905** | `cloud-mustang` | User applying remaining payment (~$2,183.87 open on $13,903.84 total after merge showed $11,719.97 paid) |
| **IN-12975** | `cloud-huntington-beach` | User adding invoice (~$1,524.50 per May 26 tracker; was missing from Firestore, caused Studio “Total Paid” vs sum mismatch) |

---

## Huntington Beach — tracker spot-check

**Tracker file:** `Houzz FILES/Project Trackers/Cloud HB project_tracker_report-05-26-2026-19-09.xlsx` (product grid, 557 rows)

**Findings:**

- **Totals:** Many invoices match tracker within ~$1 on stored `total`; gaps are mostly **LINE_GAP** (tracker has many rows, Studio still has **1** import line per invoice).
- **IN-12253:** Fixed by merge to **$45** paid (was $0 payment row on import doc).
- **IN-12975:** `MISSING_IN_STUDIO` in tracker — user adding manually.
- Full gap JSON: `_debug/hb-tracker-gap-after-merge-1779857116079.json`

**Not required for portal share:** Full tracker line backfill (separate pass, e.g. `restore-susan-lines-from-tracker.js` pattern).

---

## Client portal notes

- Portal route: `#/clientportal/` + client name (e.g. Ron & Tracey Cloud); loads all Cloud child projects.
- Portal invoice filter: `index.html` ~56693 — excludes draft/void; uses `inv.total` and **Paid → $0 balance**.
- **Do not use** Grok browser script that deletes shells without merging payments (Susan regression pattern).

---

## Scripts added or used this session

| Script | Purpose |
|--------|---------|
| `fix-dup-merge-lines.js` | Merge + dedupe (keeper = most lines, merge Houzz payments) |
| `hb-tracker-vs-studio-after-merge.js` | Studio vs project tracker diff |
| `hb-spot-check-totals.js` | Houzz/Studio screenshot vs Firestore |
| `cloud-portal-readiness.js` | All Cloud boards: dup count, paid mismatch |
| `dup-who-has-lines.js` | Confirms lines on hidden `in-*` vs list `IN-*` |
| `ui-vs-firestore-invoice-count.js` | Firestore doc count vs UI row count |

---

## Parker / Mustang edge cases (portal preview)

- **IN-12913**, **IN-12933** (Parker): merge left **paid = 0** — confirm status/amount before sharing portal.
- **IN-12905** (Mustang): partial paid — user fixing.
- Duplicate **payment rows** on some merged docs (e.g. IN-12894 pattern on HB) — `paidAmount` correct; portal uses **Paid** status for balance.

---

## Next project to check

**`katke-graceland-dr`** (Katke - Graceland Dr) — Cynthia’s stated **next current project**.

**Suggested first steps (read-only, then apply if dupes found):**

```bash
cd cch-deploy/_debug
node prod-board-dup-pattern.js   # add katke-graceland-dr to script or one-off
node fix-dup-merge-lines.js --project katke-graceland-dr
# dry run first; then --apply --backup if dup pairs exist
```

**Tracker (from `vendor-fix-all-projects.js`):**  
`Houzz FILES/ARCHIVE/project_tracker_report-02-23-2026-19-27 Katke.xlsx`

**Not in scope this session:** Platform-wide 592 duplicate invoices (non-Cloud boards), document tags backfill (`merge-houzz-legacy.js` + tracker), `index.html` invoiceListRowTotal recalc fixes.

---

## No git commit

Per user practice — Firestore and `_debug/` scripts only; no commit unless requested.
