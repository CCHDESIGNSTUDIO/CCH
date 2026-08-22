# WO-117 · Push proposal/invoice line costs onto room-board clips, duplicating on collision — v1.0 · CW Aug 19

**Change ID:** BF-012 · **Executor:** Cursor · **Verifier:** Claude · **Attempt:** 1 of 3
**Type:** ONE-OFF DATA REPAIR — not a platform code change · **Scope:** `cloud-rolling-hills` only
**Deploy:** nothing ships. No `_DEPLOY_QUEUE.md` line. The DONE note records the run.

## The problem (Cindy, Aug 19)

> *"All of the pricing updates I did in the proposal did not hit the room board copies or the Selections."*

## Grounded mechanism — this is by design, not a missed save

Proposal save **finds** the matching room clip, **stamps** `clipId`, and **skips**. It never writes `cost` / `clientPrice` onto the clip.

- `platform/index.html:13319`–`13327` — `if (existingRoomed) { … line.clipId = existingRoomed; … continue; }`
- `cchPushDocLineRoomsToLinkedClips` — `platform/index.html:13142` — stamp-only, plus a frozen-financials guard
- `cchGuardDocBackSync` — 16 references — blocks silent doc → clip money
- `cchOfferTradeCostBulkUpdate` — `index.html:16052`, `19773` — runs the **other** direction (clip/library → docs)

Confirmed independently by Cursor and by Claude reading the same bodies. **This is CLAUDE.md Rule 3 (RESOLVE vs APPLY) working correctly.** Therefore: do **not** change the save path. A one-off explicit push is APPLY mode on user action, which Rule 3 permits.

## Measured scope

From `_scripts/propagate-doc-prices-DRYRUN_BY_CLAUDE_2026-08-19.js` (read-only, already in the repo, safe to re-run):

| Measure | Count |
|---|---|
| clips on board | 631 |
| doc lines carrying an authoritative cost | 325 |
| clip updates that would be made | **42** |
| …matched via explicit `clipId` | **42 of 42** — no fuzzy matching |
| …safe fills (clip was `null` or `0`) | 27 |
| …real overwrites (clip held a different value) | 15 |
| clips targeted by more than one doc line | **4** |
| doc lines with no matching clip | 49 (leave alone) |

Known collisions include clip `obnVxSRh0Qgqu3B9yyvJ` (Bar) targeted by *Ember Pendant – Small* → 1550.00 and *Ember Pendant – Med* → 1450.00, and clip `HBi4KF9m2DdSDOXgngRJ` (MBR & Bath) targeted by *Radiance Lighted Mirror* → 1765.00 and *Radiance Lighted Mirror – CUSTOM* → 3120.00. Re-run the dry run for the current full list of four.

## What to build

A one-off script under `_scripts/`, **dry-run by default, `--apply` to write**.

### A. Non-colliding clips — update in place
Write the doc line's `cost` onto the linked clip. Stamp `_priceFromDocAt` and `_priceFromDoc = "<docLabel>:<lineIndex>"`.

### B. Colliding clips — duplicate, one clip per doc line
Order the competing lines deterministically (doc label, then line index). **First line keeps the original clip.** Each additional line gets a **new clip**:

Mirror `duplicateLibraryProduct()` at `platform/index.html:66066` exactly:

- STRIP: `id`, `houzzId`, `houzzProductId`, `productCode`, `libraryUsageRefs`, `usageRefs`, `projectRefs`, `usedInProjects`, `linkedClips`, `clipIds`, `qbItemId`, `qbDocId`, `createdAt`, `updatedAt`, `duplicatedFrom`, `_tradeCostPushedFromLibraryAt`, `_docLinkedAt`
- Strip every other `_`-prefixed key **except** `_taxonomyV`, `_categoryFixedAt`, `_taxableFixedAt`
- Deep-copy arrays (`.slice()`) and plain objects (JSON round-trip); skip Firestore Timestamp objects (`typeof v.isEqual === 'function'`)
- Then set from the doc line: `title`, `sku`, `finish` (only when the line has them), `cost`
- Set `duplicatedFrom` = source clip id, fresh `createdAt` / `updatedAt`, `_priceFromDocAt`, `_priceFromDoc`
- **Do NOT append " (copy)" to the title.** These are genuinely different products (Small vs Med), not copies.

Then restamp that doc line's `clipId` to the new clip id, writing the `items` array back **once per document**.

### C. Reversal file — mandatory
Write `_debug/REVERSAL-prices-cloud-rolling-hills-2026-08-19.json` containing, before any write: every updated clip's previous `cost`; every created clip id with its `duplicatedFrom`; every relinked doc line's previous `clipId`. One-command undo.

## HARD RULES

1. **Do not change the save path.** No edit to `cchPushDocLineRoomsToLinkedClips`, the `13319` skip, or `cchGuardDocBackSync`. The isolation is correct and stays.
2. **Do not touch `platform/index.html`.** Cursor has uncommitted copy-to-room work there (9.9.228, queued for staging). This order is `_scripts/` only.
3. **Do not use `CopyToRoom` as the duplication model.** It is a known-broken path — drops images, URLs, manufacturer; copies price as 0; invalidates category. Use `duplicateLibraryProduct` only.
4. **Never write `markupPct` or `clientPrice`.** Cost only. Cindy sells retail on some lines with no markup — a missing markup is not a defect.
5. **Scope is `cloud-rolling-hills`.** No other project, no firm-wide sweep.
6. **Leave the 49 unmatched doc lines alone.** No clip creation for lines that have no clip.
7. **Dry run first, output reviewed by Cindy, then `--apply` on her typed GO** (CLAUDE.md Rule 7). Production data write.
8. Ground before writing per `CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md`. Counts above are a lead, not evidence — re-run the dry run.

## Acceptance (binary)

1. Dry run prints counts and makes zero writes.
2. With `--apply`, the reversal JSON is written **before** the first Firestore write.
3. Every non-colliding linked clip's `cost` equals its doc line's cost.
4. Each colliding doc line points at its **own** clip id — no two doc lines share a `clipId` after the run.
5. New clips carry `duplicatedFrom` = source id, and carry none of the STRIP fields.
6. New clip titles come from the doc line, with **no "(copy)" suffix**.
7. No clip has `markupPct` or `clientPrice` written by this run.
8. No document outside `boards/cloud-rolling-hills` is written.
9. Re-running with `--apply` a second time makes **zero** further changes (idempotent).
10. `_scripts/propagate-doc-prices-DRYRUN_BY_CLAUDE_2026-08-19.js` afterwards reports **0** pending updates.

## Verify (Claude)

- Open the Bar room board → *Ember Small* and *Ember Med* are two separate clips at 1550.00 and 1450.00.
- Open MBR & Bath → *Radiance* and *Radiance CUSTOM* separate, 1765.00 and 3120.00.
- Selections for Rolling Hills shows costs matching the proposal.
- Spot-check 3 of the 15 overwrites against the proposal line.
- Confirm the reversal file restores cleanly on one clip.
- Evidence into `loop/verify/`.

## Rollback

Apply the reversal JSON: restore previous `cost` on updated clips, restore previous `clipId` on relinked doc lines, delete the created clips by id. No code to revert.
