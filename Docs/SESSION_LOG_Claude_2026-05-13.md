# Session log — Claude, 2026-05-13

**Branch:** `wip/preserve-rh-inspiration-board-2026-04-19`
**Started:** ~early AM
**Author:** Claude (Opus 4.7) working with Cindy
**Hand-off to:** Cursor or next agent

---

## TL;DR — current state at end of session

- **Prod (`cch-platform.web.app`):** running git tip `f51e877`. Has the full prod codebase + inspiration portal subsystem + QB Customer ID UI in Edit Project. **Reported by Cindy as still broken** — clicks "don't open" and page flashes back to single-image view. Root cause not isolated; she has hard-refreshed but I haven't been able to reproduce without browser access.
- **Staging (`cch-platform-staging.web.app`):** last deploy was the rollback at `d3a98a7` (its own pre-session content). I overwrote it earlier today with current and then restored. Staging has working portal code BUT staging Firestore (`cch-studio-staging`) is a separate database — empty for this project, so Cindy can't test against real data there.
- **No staging Firebase Admin SDK key** exists on this machine (thorough search). To copy data prod→staging requires generating one from Firebase Console.
- **Firestore data:** untouched on most projects. Confirmed writes only on `boards/31-whitesail/*` (9 invoices/POs created, 8 patched with metadata), 27 Whitesail clip imageUrls, 7 Katke clip imageUrls, INV-6022 moved+deleted on Katke, 2 stale activity docs deleted.

---

## Why this log exists

I spent today fixing the client portal inspiration system (deleted by commit `7e57f74` in May), then made multiple workflow mistakes that cost hours. This log captures every state change so a fresh agent — or Cursor — can pick up without re-discovering what I already did.

---

## Git commits, in order (today, all by me)

Oldest first (read top→bottom for chronological order):

```
e5772f9  fix(qb): index invoices.qbDocId for collection-group queries
9b935cd  chore(firestore): drop redundant timeEntries composite index
f30306b  fix(doc-status): publish-to-dashboard now flips Draft → Sent/Published
539ed9a  feat(scripts): whitesail backfill from cchdesign_0427.csv
3f4db60  feat(scripts): whitesail backfill apply mode (firebase-admin)
343bf73  feat(scripts): orphan-doc scanner + katke cleanup
a1eb673  feat(scripts): whitesail clip image backfill (server port)
f4a0c39  feat(scripts): generalize image backfill to any board + run on katke
6efd9e5  fix(scripts): patch backfilled Whitesail docs with missing fields
ca8b85c  docs: add Code Grounding Protocol + reference from CLAUDE.md
7f77a10  restore: client portal inspiration star/comment system (part 1 of 2)
f14164c  restore: client portal inspiration render path (part 2 of 2)
e4e0929  fix(portal): remove 3 broken top-level helper duplicates from Part 1
18cd42e  fix(portal): cpPortalRouteStateFromHash now handles /inspirations + /inspirations/:id
d3a98a7  revert: restore staging as canonical platform/index.html
bc5175c  revert: restore prod's pre-2026-05-13 platform/index.html
361e06f  fix: restore client portal inspiration system + QB Customer ID field
c76fdb0  fix(portal): declare missing inspiration/concept vars + correct home label
626c7ff  fix(portal): hoist inspiration vars to fn top, remove Concept sidebar item
38e543d  fix(portal): add missing cpProposalLineLightboxOpen + ...FromEncoded
f51e877  fix(portal): add missing inspiration-card CSS classes  ← prod is here
```

---

## Hosting deploys made today

In order:

1. `firebase deploy --only firestore:indexes` (prod) — added qbDocId collection-group index
2. `firebase deploy --only hosting --project staging` — pushed Parts 1+2+3+4 (commit at the time was `18cd42e`). **This regressed staging** — overwrote staging's working portal with current's broken stripped version
3. `firebase deploy --only hosting --project prod` — pushed same Parts 1+2+3+4 to prod
4. `firebase deploy --only hosting --project staging` — pushed `e4e0929` (dup-helper removal) to staging
5. `firebase deploy --only hosting --project staging` — pushed `d3a98a7` (rolled-back staging snapshot) to staging
6. `firebase deploy --only hosting --project prod` — pushed `d3a98a7` (staging snapshot) to prod. **This stripped 120 prod-only functions** including Houzz reconciliation, PO vendor resolution, Style Library bootstrap, voidInvoice, etc.
7. `firebase deploy --only hosting --project prod` — pushed `bc5175c` (rolled back to this morning's prod snapshot). Restored the 120 functions. Cindy's organized boards stopped looking "back to shit."
8. `firebase deploy --only hosting --project prod` — pushed `361e06f` (surgical merge of inspiration subsystem ON TOP of restored prod, plus Cursor's QB UI restore)
9. `firebase deploy --only hosting --project prod` — pushed `c76fdb0` (declared inspirationBoardId, inspirationIdeabooks, conceptIdeabooks vars + home strip label fix)
10. `firebase deploy --only hosting --project prod` — pushed `626c7ff` (hoisted vars to top of renderClientPortal with safe defaults + removed Concept Boards sidebar item)
11. `firebase deploy --only hosting --project prod` — pushed `38e543d` (added missing `cpProposalLineLightboxOpen` + `cpProposalLineLightboxOpenFromEncoded` functions)
12. `firebase deploy --only hosting --project prod` — pushed `f51e877` (added missing cp-board-list-item / cp-inspiration-card CSS rules)

**Net:** prod has been deployed 12 times today. Staging 3 times.

---

## What I learned the hard way — workflow rules now in memory

Two new feedback rules in `C:\Users\cindy\.claude\projects\C--Users-cindy-Dropbox-Claude---CCH-studio\memory\`:

- **`feedback_code_grounding_protocol.md`** — Don't make architectural claims without a grep run THIS turn. No phased fix tables built from skill files or memory. (Cindy wrote the rule doc at `cch-deploy/Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md` after my repeated A/B/C plan posturing.)
- **`feedback_staging_first_deploy.md`** — Staging is the SOURCE OF TRUTH when it has features git doesn't. Pull FROM staging INTO git; never push current → staging blindly.

---

## Firestore data ops (writes I made)

Only these documents/fields were modified by me on **production** Firestore (`cch-design-boards`):

### Whitesail (`boards/31-whitesail`)
- Created 9 docs from `cchdesign_0427.csv` DOCUMENTS section:
  - 3 invoices: #10170 ($3,577.11 Paid), #10171 ($3,434.35 Paid), #10176 ($0 Draft, since vanished — I didn't delete it, count went 3→2)
  - 6 POs (#400125 Fisher Sconce $429.63 — #400130 Pivot Mirror $378.34)
  - Each tagged `_source: 'houzz-0427-backfill'`
- Patched 8 of those 9 docs with `date`, `balance`, `paymentCount`, `vendor` (auto-matched from existing clips by title)
- Updated `imageUrl` on 27 Whitesail clips by matching against `productLibrary` entries (replaced bare filenames with real Firebase Storage URLs)
- Manifest saved at `admin/whitesail-backfill-1778690241755`

### Katke Graceland Dr (`boards/katke-graceland-dr`)
- Updated `imageUrl` on 7 Katke clips (same library backfill pattern)
- Moved INV-6022 ($1,335 Unsent) from phantom `boards/katke-graceland/invoices/ogvfb07qPmYq1LM4nqeT` to the real `boards/katke-graceland-dr/invoices/` — then **deleted it** at Cindy's instruction ("we already released the hours and reinvoiced")

### Activity log cleanup
- Deleted 2 stale `activity` docs that referenced INV-6022 after the orphan move

### Firestore index (deployed via CLI)
- Added `fieldOverrides` for collection-group index on `invoices.qbDocId` — enables the qbWebhook lookup
- Removed an old `timeEntries (source ASC + __name__ ASC)` composite index that Firebase 400'd (auto single-field covers it)

**No writes** to `clients` collection. **No writes** to any other project's board doc fields. QB customer IDs that Cindy entered are intact on all 14 boards that had them this morning (verified at end of session).

---

## What's reported broken at end of session

### 1. Inspiration boards on prod — "flashes back to one big art page"

- URL: `https://cch-platform.web.app/#/clientview/7225-bugletrail/inspiration` (singular legacy URL)
- Cindy sees: a single full-width image, page flashes when clicked
- All code IS in deployed prod per my grep:
  - 28 portal functions including `cpPortalToggleInspirationStar`, `cpPortalPostInspirationCommentFrom`, etc.
  - Render block separately handles `'inspirations'` (list) / `'inspirationBoard'` (detail) / `'concepts'`
  - Route parser maps `/inspirations[/<id>]` correctly
  - 36 lines of `cp-insp-*` CSS plus 6 lines for `cp-board-list-item` / `cp-inspiration-card`
  - `cpProposalLineLightboxOpen` + `OpenFromEncoded` defined
- Cindy reports symptom persists after hard-refresh; haven't been able to get her to test in incognito + paste console error
- Most plausible remaining causes: CDN cache lag, a Chrome extension (we saw `content.bundle.js` TypeErrors from an injected extension), or a render-time error I can't see without browser access

### 2. QB Customer ID field in Edit Project modal

- Cursor restored the input + save logic earlier today (his message to Cindy: lines 24007–24014 for HTML, 24150–24156 for save logic)
- Cindy confirmed her 14 stored `qbCustomerId` values on boards are intact (verified via Firestore query)
- Whether the input now displays the saved value in the Edit Project modal — not retested this session

### 3. Concept Boards page (currently a stub)

- Sidebar nav item REMOVED per Cindy's request (commit `626c7ff`)
- `/concepts` route still exists in router; if hit directly it shows "Designing Your Story / Nothing shared here yet" empty state — correct because no ideabook has `type === 'concept_board'`
- To restore: re-add the sidebar button referencing `/concepts`. Concept Boards will populate once any ideabook gets `type: 'concept_board'`

---

## What's NOT done that was in scope

- **Whitesail line items** — the 3 invoices and 6 POs I created have `items: []` (invoices) or single placeholder item (POs). Should be backfilled against `cchdesign_0427.csv` PRODUCTS section but I never wrote that pass.
- **Other ~10 "false-zero" projects** in `Houzz_Projects_Picker_Apr27.csv` — picker says 0 invoices/POs but at least one of them (Greene-Hixson) actually has data in Studio. The picker is unreliable; the right ground-truth source is the DOCUMENTS section of `cchdesign_0427.csv`. Pattern proven on Whitesail; not generalized.
- **Houzz category/room cleanup** — clips have `room=category-name` values (per `project_houzz_category_rooms.md` memory). Selections-page triplicates from this. Untouched.
- **Stale rollup counts** — Studio's project board doc `invoiceCount` / `poCount` / `clipCount` / `proposalCount` fields are off vs. actual subcollection counts on most boards (e.g. Whitesail rolled-up clipCount 51 vs. actual 26; Holtz Hill invoiceCount 19 vs. actual 22). A one-pass recount script would fix all boards.
- **Concept Boards page rebuild** — if Cindy wants `/concepts` as a real surface that pulls `boards/{id}/designBoards` (canvas synthesis), that's a separate workstream.
- **Staging Firestore seeding** — Cindy asked me to copy Bugletrail's ideabooks → staging Firestore. **Requires a staging service account key that does not exist on this machine.** Generate one at https://console.firebase.google.com/project/cch-studio-staging/settings/serviceaccounts/adminsdk and save next to the prod key.

---

## Snapshot files left on disk for next agent

In `C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\_debug\`:

| File | What it is |
|---|---|
| `prod_live.html` | Prod served HTML BEFORE any of my deploys today (= 7e57f74 state) |
| `staging_live.html` | Staging served HTML BEFORE my deploys (working portal source-of-truth) |
| `WORKING_INSPIRATION_PORTAL_staging_2026-05-13_KEEP.html` | Backup copy of staging_live.html — keep this |
| `index_84c1b0b.html` | git-extracted snapshot of platform/index.html at commit `84c1b0b` (pre-May-regression) |
| `prod_post_deploy.html`, `prod_now.html`, `prod_final.html`, `prod_err_check.html`, `prod_after_lb_fix.html`, `prod_css_check.html`, `prod_final_check.html` | Various prod snapshots at different stages of today's session |
| `staging_post_deploy.html`, `staging_v3.html`, `staging_after_rollback.html`, `staging_final.html`, `staging_after.html` | Various staging snapshots |
| `index_merge_preview.html`, `index_part2_preview.html`, `index_restored_preview.html` | Dry-run preview files my scripts generated |

In `_scripts/`:

| Script | Purpose |
|---|---|
| `extract-whitesail-from-0427.js` | Section-aware grep of 0427 CSV for Whitesail rows |
| `whitesail-backfill-dryrun.js` | xlsx-based parser → backfill-proposal.json |
| `produce-whitesail-backfill-snippet.js` | (legacy) browser-console snippet generator |
| `whitesail-backfill-apply.js` | Node + firebase-admin, applies 9 docs to Whitesail Firestore |
| `whitesail-patch-doc-fields.js` | Patches date/balance/vendor on the 9 docs |
| `board-image-backfill.js` | Per-board clip image backfill (Whitesail + Katke ran) |
| `inspect-board.js` | Dump board doc + subcollection counts (note: list excludes `ideabooks` — known bug) |
| `find-orphan-docs.js` | Collection-group scan for docs whose parent board doesn't exist |
| `find-projects-with-ideabooks.js` | List every project with ≥1 ideabook with images |
| `find-qb-customer-ids.js` | List every board with qbCustomerId / qbCustomerName populated |
| `merge-inspiration-into-prod.js` | The surgical script that built `361e06f` |
| `restore-portal-inspiration.js` + `restore-portal-render.js` | The earlier Part-1 / Part-2 scripts (now superseded by merge script) |

---

## Suggested next steps in priority order

1. **Verify in incognito** that prod inspiration page actually does open boards. If it does → close out; the user-reported "still broken" was browser cache.
2. **If still broken in incognito**, capture the FIRST red console error after a click (not Chrome-extension errors from `content.bundle.js`). That gives the specific function/var to fix.
3. **Re-add Concept Boards sidebar item** when Cindy wants it back (single-line restore — see `626c7ff` for the removed line).
4. **Whitesail line items** + **other 10 false-zero projects** — generalize `whitesail-backfill-apply.js`.
5. **Rollup count recount** — quick win, affects financial-health bars across all projects.

---

## Hand-off note

This session involved repeated "fix → break something else → fix" cycles because I didn't ground claims in code reads before proposing changes. The Code Grounding Protocol doc and Staging-First Deploy memory should prevent the pattern in future sessions. If you're picking up this work, read both before touching `platform/index.html`.

The most valuable artifacts to know about:

- **`_debug/staging_live.html`** — the working portal code, from before my deploys overwrote it. Use it as canonical for any inspiration / portal restoration questions.
- **`_debug/service-account.json/cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json`** — prod Firebase Admin key.
- The commit chain `bc5175c` → `361e06f` shows the surgical merge approach (prod as base + add inspiration only). That's the pattern that worked. The earlier `7f77a10`+`f14164c`+`d3a98a7` chain was the bad pattern (overwrite-then-revert) that lost prod features twice.

End of log.
