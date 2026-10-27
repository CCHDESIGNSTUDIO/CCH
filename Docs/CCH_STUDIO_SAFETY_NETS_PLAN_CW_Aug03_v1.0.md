# CCH Studio — Safety Nets Plan (stop the daily back-slide) · CW Aug 03 v1.0
**Owner:** Cindy (gate) · **Builder of app-side pieces:** Cursor · **Builder/runner of the harness + verifier:** Fable (Cowork)
**Purpose:** Stop the "2 steps forward, 3 steps back" pattern by catching regressions before they reach Cindy live, and by making working features impossible to quietly undo.

---

## 1. The problem, named plainly
Fixes don't stay fixed. Today alone: the category-as-room lock came undone, design boards went sticky again after being fixed, expenses took ~20 patches, a formatted note got eaten. This is not Cursor being careless and it is not Cindy. It is structural:

- The platform is one ~5MB `platform/index.html` file, so a change anywhere can hit anything (collateral damage).
- There is no automated check between "Cursor ships" and "Cindy hits it live," so breaks are discovered mid-workday.
- Several surfaces have multiple code paths / heuristics that disagree, so a fix to one path re-breaks another.
- Nothing that works is *locked*, so the next change can silently overwrite it.

Safety nets attack all four.

## 2. Definition of done (what "safe" looks like)
- No change reaches production without passing an automated smoke run + matching the golden references + Fable sign-off.
- A regression is caught by a script within minutes of a staging deploy, not by Cindy hours later.
- Every prod release is a tagged, known-good snapshot with a one-step rollback.
- A working feature has a test pinning it, so a later change that breaks it fails loudly.

## 3. The watch list (the surfaces that actually break)
Grounded in this session's history. These get covered first:

1. **Invoice render (Design Services):** expense vs hours classification, prepaid sales tax to totals only, the Client Summary & Outcomes (summarize, don't dump; CCH voice) — WO-065.
2. **Design Boards:** duplicate element IDs / sticky selection, panel close — WO-064.
3. **Proposal ↔ Room-board sync:** multi-room proposals, placement model, suppression of removed items — WO-045 / 055 / 058.
4. **Price integrity:** corrupt unit prices, ghost/duplicate clips, client-visible room pricing.
5. **Category-as-room lock:** Fabrics/Furnishings must never reappear as rooms.
6. **Notes:** formatted notes + publish to portal (once WO-066 ships), keep formatting on save.
7. **Cross-cutting:** no console errors on any client-facing route; client portal shows nothing forbidden (rates, POs, margins, cost, team, raw time).

## 4. The layers (by return on effort)

### Layer 1 — Automated smoke suite against staging  *(highest ROI, start here)*
A headless Playwright script that loads the staging app, signs in, walks each watch-list flow, and asserts the things that matter (totals correct, no raw dump, no duplicate element IDs, sync works, no console errors). Runs in minutes.
- **Who:** Fable authors and runs it (browser tooling is available here). No app-code change needed.
- **Trigger:** on every staging deploy, and nightly on a schedule.
- **Output:** pass/fail per surface, with a screenshot on failure, logged to `loop/verify/smoke/`.

### Layer 2 — Golden-reference snapshots for the chronic surfaces
Extend what we already did for the DS invoice. Capture known-good rendered output (HTML + screenshot) for each watch-list surface, commit it, and make every change re-render the same fixtures and diff against the reference. Unexpected change = rejected. This is what specifically stops "fixed X, silently broke Y."
- **Who:** Fable captures references; Cursor runs the diff as part of a change.

### Layer 3 — Frozen staging fixture project
One permanent fake client with deliberately nasty data: multi-room proposal, invoice with expenses + prepaid tax, a board with many elements, a corrupt-price clip, a category-as-room trap. It never changes, so drift is instantly visible. Everything is test-driven on this, not on whatever real project is open.
- **Who:** Fable + Cindy define the fixture once; it becomes the standard track.

### Layer 4 — Hard promotion gate + rollback
No prod deploy unless: smoke suite green + golden references match + Fable sign-off. Every prod promotion is a tagged known-good snapshot (build version + a saved copy), so a slip-through rolls back to last-green in one step instead of hot-patching forward.
- **Who:** Process rule Cindy enforces; Fable verifies; Cursor tags the snapshot. This is the codified version of the verification ledger and "DONE = awaiting Fable."

### Layer 5 — Shrink the blast radius  *(background, not first)*
Root cause is the monolith. Over time, carve the stable subsystems (invoice render, design board, proposal sync) into bounded files, and collapse the "three code paths that disagree" into one (as we did for the DS classifier). Slow and itself risky, so it runs quietly behind Layers 1 to 4.
- **Who:** Cursor, one subsystem at a time, each extraction gated by the smoke suite.

## 5. Phased rollout

**Phase 0 — this week (prove it catches things).**
Fable stands up the Playwright harness against staging, gets sign-in working, and writes ONE canary test pointed at a bug we already know exists, so Cindy watches it go red and trusts it. Define the frozen fixture project.

**Phase 1 — weeks 1 to 2 (cover the watch list).**
A smoke test per watch-list surface. Golden references for the invoice + design board + proposal sync. Console-error tripwire on client routes. Assemble into a single pre-prod checklist run.

**Phase 2 — weeks 2 to 4 (make the gate hard).**
Wire "green smoke + golden match + Fable sign-off" as a required gate before any prod promotion. Tagged rollback snapshots. Nightly scheduled smoke run so overnight/Cursor changes are caught by morning.

**Phase 3 — ongoing (starve the back-slide).**
Every new WO ships with its own smoke assertion (coverage grows with the app, never shrinks). Begin modularizing one stable subsystem at a time.

## 6. Roles
- **Fable (Cowork):** builds and runs the smoke suite, captures golden references, defines the fixture project, verifies every change on staging, signs off before prod.
- **Cursor:** builds app-side pieces (diff-on-change, snapshot tagging, modularization), fixes what the nets catch, minimal diffs with file:line grounding.
- **Cindy:** owns the fixture definition, enforces the gate, types GO for prod. Not in the mechanics.

## 7. How we know it's working (metrics)
- Prod regressions per week trend toward zero.
- Time from "regression introduced" to "regression caught" drops from hours (Cindy, live) to minutes (script, staging).
- Every rollback is one step, never a scramble.
- Watch-list coverage only grows.

## 8. The honest tradeoff
This slows new-feature shipping for a stretch, and building the harness is real upfront work (mostly Fable's, not Cindy's). It pays back inside a week or two, because the hours currently lost to re-broken things stop leaking.

## 9. First move (needs nothing from Cindy but a nod)
Fable builds the Phase 0 canary this week: Playwright against staging, pointed at one known bug, red on purpose. Once Cindy sees it catch something real, we roll forward through Phase 1. Cindy's only input needed: confirm the watch list in section 3 is the right set, add any offender that's missing.
