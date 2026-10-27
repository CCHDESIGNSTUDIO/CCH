# CCH Studio — Open Items Audit

**Author:** Cursor (CR) · **Date:** Aug 13, 2026 (morning audit + EOD reconciliation)  
**Sources:** `loop/LOOP_LEDGER.md`, `loop/WO-*`, `_DEPLOY_QUEUE.md`, `Docs/ESPEC_*`, Dropbox Aug 12 mirrors, code spot-checks  
**Companion HTML:** `Docs/CCH_STUDIO_OPEN_ITEMS_BOARD_CR_Aug13_v1.0.html`  
**Agent lane:** `Docs/AGENT_DELIVERABLES_PLAYBOOK_CR_Aug17_v1.0.md`  
**Limitation:** Claude project docs (`claude/*`) unread — no `Projects` / `project_read` in Cursor  
**Last strategic update:** Aug 17, 2026 (Cindy — agent deliverables lane + client iPad priority)

---

## Aug 17 strategic reframing (Cindy)

### Agent lane vs Studio lane — do not build Houzz GC tools in-app

| Lane | Who | What |
|------|-----|------|
| **Studio (live app)** | Staff + clients on portal | Proposals, decisions, inspiration, updates, invoices, POs, QB — **interactive, Firestore-backed** |
| **Agent lane (Claude + Cursor)** | Cindy, Vanessa, agents | Room books, spec packages, takeoff spreadsheets, presentation decks, reconciliation reports — **produced from exports + briefs, delivered as PDF/HTML/Docs** |

**Explicitly out of Studio scope:** AI floor-plan takeoffs, 3D from scans, construction schedules, receipt OCR. Agents can produce takeoff *deliverables* when Cindy provides plans — no need to match Houzz in-app takeoff UI.

**Competitive note:** Houzz Pro targets small designers on quick remodels (often no CAD/SketchUp). CCH = luxury FF&E, high-touch clients, deep procurement. Win on **portal experience + agent-produced deliverables**, not GC feature parity.

### New priority — client iPad / phone (P0 client-facing)

Most clients review on **iPad**, not desktop. `client.html` has viewport meta + breakpoints (768 / 1024) but was not designed or QA'd as **tablet-first**. See **WO-114**.

---

## EOD Aug 13 updates (since morning audit)

| Item | Morning state | EOD state |
|------|---------------|-----------|
| **WO-112** Smart Time source split | OPEN, not coded | **DONE-UNVERIFIED** — staging **9.9.162** deployed |
| **WO-113** Proposal → Selections → Room Boards | not listed | **NEW** — Part 1 coded **9.9.168** queued; Parts 2–3 open (`HANDOFF_WO-113_*`) |
| **Smart Time glyph fix 9.9.159** | pending deploy | **done** — bundled staging **9.9.160** |
| **WO-045 durability** | open standalone | folded into **WO-113 Part 2** |
| **Selections sync (PRO-3035 / Arcilla)** | not listed | research complete — display/sync bug, data not deleted |
| **Tear sheet 3A/3B** | not listed | staging **9.9.163–167** shipped |

---

## STATUS BOARD (Aug 06)

**Not available.** `claude/CCH_WO_STATUS_BOARD_CW_Aug06.html` is project-only; no `Projects` `project_read` tool in this Cursor session and no local copy. Cross-check used `loop/LOOP_LEDGER.md` (log through Aug 10) plus `_DEPLOY_QUEUE.md` (through Aug 13).

## VERIFICATION LEDGER (Jul 30)

**Full ledger file not readable.** `claude/VERIFICATION_LEDGER_CW_Jul30.md` is project-only. Partial reconstruction from `loop/LOOP_LEDGER.md` Jul 30 log entry:

| item | verification state | notes |
|------|-------------------|-------|
| WO-064 duplicate el_* IDs | VERIFIED* | Live build 9.9.48; Powder Baths healed; caveat: heal in-memory only |
| WO-065 auto-save after heal | OPEN (Jul 30) | Cut Aug 1; now DONE-UNVERIFIED in ledger |
| WO-061 stale clip sync | DONE, Fable not yet verified | Jul 30 debt queue |
| WO-056 duplicate-not-move | DONE, Fable not yet verified | Jul 30 debt queue |
| WO-057 trade-cost push | DONE, Fable not yet verified | Jul 30 debt queue |
| WO-062 Pepper staff assistant | DONE, Fable not yet verified | Jul 30 debt queue |
| WO-063 staff chat | DONE, Fable not yet verified | Jul 30 debt queue |
| WO-060 tile-name hide (Arcillas) | GAP / never cut | Flagged needed; no WO file on disk |

## WO-069-B CHAIN

WO-069-B shipped staging `ft028` picker (project materials first + All Product Library + ghost filter). Fable verify found price-through PASS but **Cost cell blank** on PRO-3012 (`WO-069-B_FINDING_cost-not-on-line_CW_Aug04.md`: "Cost-population: **follow-up**, folded into WO-069-B"). Follow-up `ft028c-cost-on-line` fixed `builderLibraryUnitPrices` derive path (`WO-069-B_DONE_CR_Aug03c_cost.md`). Ledger marks **PROD** Aug 3 with Cindy GO. Deep ghost canary with `STAGING_BUILDER_PROJECT_ID` and full Fable sign-off were still optional/pending in FINDING doc; no later doc in this set shows them closed. **Current state:** shipped to prod; optional deep assert and canary whitelist remain unconfirmed.

## OPEN

### Studio / ledger OPEN (authoritative: `loop/LOOP_LEDGER.md`)

- **WO-001** | source: `loop/LOOP_LEDGER.md` | date: Jul 10
  - what: Staging verification sweep RB-1 + DOC-1, verify-only.
  - status signal: "OPEN"
  - owner: Claude (verify-only)
  - blocker: none stated

- **WO-007** | source: `loop/LOOP_LEDGER.md` | date: Jul 11
  - what: Project PO tab reuses Order Management layout.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: "Ground cch-order-management.js first"

- **WO-008** | source: `loop/LOOP_LEDGER.md` | date: Jul 11
  - what: Room board approve/decline notifications + badge.
  - status signal: "BLOCKED-DISCUSSION"
  - owner: Cursor
  - blocker: "Schema changes = needs Cindy GO"

- **WO-020** | source: `loop/LOOP_LEDGER.md` | date: Jul 11
  - what: Staging Houzz OM parity (data reconcile).
  - status signal: "BLOCKED-DISCUSSION"
  - owner: Cursor 1
  - blocker: "bulk staging Houzz close-out needs Cindy GO"

- **WO-025** | source: `loop/LOOP_LEDGER.md` | date: Jul 12
  - what: Fix-It AI first-responder on Bugs & Requests.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-026** | source: `loop/LOOP_LEDGER.md` | date: Jul 12
  - what: Line icons leaking window-treatment icon onto expense lines.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-027** | source: `loop/LOOP_LEDGER.md` | date: Jul 12
  - what: PO summary strip tiles do not reconcile (Ordered = Paid + Open Balance).
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-028** | source: `loop/LOOP_LEDGER.md` | date: Jul 12
  - what: Bi-weekly Progress Update Phase B editor (upload/swap images, edit text).
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-029** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Wire CCH voice profile into invoice AI + bi-weekly composer.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: "Prod invoice AI = GO required"

- **WO-030** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: In-app Release Notes current through recent builds.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-031** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Inspiration lightbox Find similar + placeholder clip fix.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-032** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Edit/delete payments on detail view + retainer double-count guard.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **HOTFIX-032** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Payment edit/delete buttons dead on prod (onclick quote collision).
  - status signal: "OPEN-URGENT"
  - owner: Cursor
  - blocker: "LIVE PROD BREAK"

- **WO-033** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Invoice/PO line editor live-recalc footer totals.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-034** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: QB sync audit/fix taxable flags on services/fees.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-036** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Finance pages default YTD + scoped load.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-037** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Client Portal Updates list magazine-style cards.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-038** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Retainer/credit as deduction under subtotal, not grid line.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-039** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Log Correspondence real file upload (URL-only today).
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-040** | source: `loop/LOOP_LEDGER.md` | date: Jul 13
  - what: Bulk-link unlinked invoices/POs to QB by DocNumber.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-046** | source: `loop/LOOP_LEDGER.md` | date: Jul 15
  - what: Request for Pricing (RFQ) to vendors.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-047** | source: `loop/LOOP_LEDGER.md` | date: Jul 15
  - what: Client Updates Build from project auto-draft.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-048** | source: `loop/LOOP_LEDGER.md` | date: Jul 17
  - what: Unify tear-sheet engine across all entry points.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: "After WO-041 verify FAIL (old generator still live)"

- **WO-054-B** | source: `loop/LOOP_LEDGER.md` | date: Jul 23
  - what: Builder update proposal from WO + multi-select + close-out.
  - status signal: "OPEN"
  - owner: Cursor Raul (Builder)
  - blocker: "build after prod ft020–022 ship"

- **WO-085 A/B** | source: `loop/LOOP_LEDGER.md` | date: Aug 06
  - what: Project recent activity recency filter + missing Studio event capture (§C shipped).
  - status signal: "OPEN (A/B)"
  - owner: Cursor
  - blocker: none stated

- **WO-087** | source: `loop/LOOP_LEDGER.md` | date: Aug 06
  - what: Release notes current + image-based.
  - status signal: "OPEN"
  - owner: unstated
  - blocker: "Cindy Aug06: skip image/design — Fable handles"

- **WO-094** | source: `loop/LOOP_LEDGER.md` | date: Aug 06
  - what: Clipper Add images on existing product + Studio ID stamp.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: none stated

- **WO-109** | source: `loop/LOOP_LEDGER.md` | date: Aug 09
  - what: Bug-work visible, never bill, hours-lost tally.
  - status signal: "OPEN"
  - owner: Cursor
  - blocker: "after 108"

- **SEL-1** | source: `loop/LOOP_LEDGER.md` | date: Jul 10
  - what: Selections edit persistence.
  - status signal: "BLOCKED-DECISION"
  - owner: unstated
  - blocker: "Needs Cindy a/b/c"

- **Room placement model** | source: `loop/LOOP_LEDGER.md` | date: Jul 29
  - what: One placement per (item, room); coordinated WO not cut.
  - status signal: "BLOCKED-SCOPING"
  - owner: Fable
  - blocker: "no code until scoped"

- **WO-060 GAP** | source: `loop/LOOP_LEDGER.md` | date: Jul 30
  - what: Design Board tile-name hide fix (Arcillas).
  - status signal: "GAP"
  - owner: unstated
  - blocker: "no WO file exists on disk, never cut"

### Client portal — iPad / mobile first (added Aug 17)

- **WO-114** | source: `loop/WO-114_client-portal-ipad-mobile-first_CW_Aug17.md` | date: Aug 17
  - what: Client portal (`client.html`) optimized for iPad + iPhone — proposals, inspiration, bi-weekly updates, decisions, tear sheets.
  - status signal: "OPEN — Cindy: clients look on iPad not computer"
  - owner: Cursor
  - blocker: needs real-device QA pass (iPad Safari + Add to Home Screen)

### Sync / Selections (added EOD Aug 13)

- **WO-113** | source: `loop/WO-113_proposal-selections-roomboard-trilogy-sync_CW_Aug13.md` | date: Aug 13
  - what: PRO-3035 lines on proposal missing from Selections/Room Boards; board-scoped proposal ingest + clip ensure durability + picker parity.
  - status signal: "Part 1 coded; Parts 2–3 OPEN"
  - owner: Cursor
  - blocker: Part 2 needs staging GO for default-on clip ensure

- **WO-092 Parts 2–3** | source: `loop/LOOP_LEDGER.md` | date: Aug 07
  - what: Library duplicate rows + Studio ID stamp (Part 1 display dedupe shipped 9.9.107).
  - status signal: "Part 1 DONE-UNVERIFIED; Parts 2–3 OPEN"
  - owner: Cursor
  - blocker: none stated

### Pepper / activity (specs in `loop/`; code-checked Aug 13)

- **WO-100** | source: `loop/WO-100_pepper-tasks-in-project-digest_CW_Aug07.md` | date: Aug 07
  - what: Include project Tasks in Pepper per-project digest.
  - status signal: "It does **not** include tasks."
  - owner: Cursor
  - blocker: `buildFullDigest` still has no `buildTasksDigest` (code @648)

- **WO-101 desktop PWA** | source: `loop/WO-101_pepper-desktop-shell-pwa_CW_Aug07.md` | date: Aug 07
  - what: Installable Pepper desktop shell (dedicated page + manifest).
  - status signal: unstated OPEN in spec; no `pepper.html` in repo
  - owner: Cursor
  - blocker: "voice loop = WO-102 next"

- **WO-101 follow-up loops** | source: user list `claude/WO-101_pepper-follow-up-loops-po-and-client_CW_Aug07.md` | date: Aug 07
  - what: Pepper follow-up loops for PO and client (second WO-101; project-only).
  - status signal: not locally verified
  - owner: unstated
  - blocker: WO number collision with desktop PWA WO-101

- **WO-105 follow-ons** | source: `loop/WO-105_DONE_CR_Aug09.md` | date: Aug 09
  - what: Client-activity money cues, Timely missing-day names, drafts-on-tap per bucket.
  - status signal: "Client-activity money cues + Timely missing-day names = follow-on"
  - owner: unstated
  - blocker: "not full WO-106 yet"

- **WO-106** | source: `loop/WO-106_pepper-all-seeing-firmwide_CW_Aug07.md` | date: Aug 07
  - what: Firm-wide all-seeing Pepper rollup cache across all project state.
  - status signal: not in ledger as DONE; spec only
  - owner: Cursor
  - blocker: none stated

- **WO-110** | source: `loop/WO-110_activity-feed-rebuild-studio-only_CW_Aug09.md` | date: Aug 09
  - what: Idempotent activity rebuild with real timestamps, Studio-only.
  - status signal: "Rebuild is **not idempotent**"
  - owner: Cursor
  - blocker: code still uses `activity.add()` @81598, not upsert

- **WO-111** | source: `loop/WO-111_daily-activity-timeline-day-in-review_CW_Aug09.md` | date: Aug 09
  - what: Daily per-person activity timeline / Day in Review.
  - status signal: not in ledger; no DONE_CR
  - owner: Cursor
  - blocker: depends on WO-110 data quality

### Smart Time / deploy (this session)

- **Time Ledger no double-create** | source: `_DEPLOY_QUEUE.md` | date: Aug 11
  - what: Prevent duplicate invoice create from Time Ledger.
  - status signal: "STATUS: pending"
  - owner: #1
  - blocker: none stated

- **Project-grouped Day table** | source: `Docs/HANDOFF_SmartTime_Agent_vs_Timely_Reconciliation_CW_Aug13_v1.0.md` | date: Aug 13
  - what: Day view grouped by project with Time | Activity | Notes columns.
  - status signal: not built (handoff Phase D)
  - owner: unstated
  - blocker: none stated

### WO-DRAFT-A follow-ons (variance)

- **Inline disposition picker** | source: `loop/WO-DRAFT-A_DONE_CR_Aug12.md` | date: Aug 12
  - what: UI for undecided variance components before billing.
  - status signal: "Not in this pass"
  - owner: unstated
  - blocker: "blocks billing until remapped"

- **Variance dry-run migration** | source: `loop/WO-DRAFT-A_DONE_CR_Aug12.md` | date: Aug 12
  - what: Firestore migration for existing variance component shape.
  - status signal: "Dry-run Firestore migration writes"
  - owner: unstated
  - blocker: none stated

- **QB taxable mapping §7** | source: `loop/WO-DRAFT-A_DONE_CR_Aug12.md` | date: Aug 12
  - what: QB taxable mapping follow-on for variance components.
  - status signal: "QB taxable mapping follow-on (§7)"
  - owner: unstated
  - blocker: none stated

### E-Spec Book (v2.1 briefing; partial build on staging)

- **productDocs multi-link** | source: `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Aug11_v2.1.md` | date: Aug 11
  - what: Add `productDocs[]` typed list (spec + installation) on products.
  - status signal: "Add a small typed list on the product/clip"
  - owner: Cursor
  - blocker: not in code (only single `specUrl` exists)

- **Reece N-up download modal** | source: `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Aug11_v2.1.md` | date: Aug 11
  - what: PDF download with 1/2/4/6 images per page and display-level toggles per Reece modal.
  - status signal: "Options: **images per page (1 / 2 / 4 / 6)**"
  - owner: Cursor
  - blocker: staging has wizard + print/PDF export but no N-up modal per briefing

- **Shareable token live book** | source: `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Aug11_v2.1.md` | date: Aug 11
  - what: External-view shareable grouped card page for contractors/clients.
  - status signal: "expose it via the external-view token route"
  - owner: Cursor
  - blocker: not found in code Aug 13

- **Cloud Function PDF engine** | source: `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Aug11_v2.1.md` | date: Aug 11
  - what: Headless Chrome CF for print-quality multi-page PDF.
  - status signal: "**Recommendation: Cloud Function.**"
  - owner: unstated
  - blocker: client-side print path only today

- **Pre-build grounding §9** | source: `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Aug11_v2.1.md` | date: Aug 11
  - what: Confirm renderSpecBookTab completeness, clipId on invoice lines, spec-URL coverage audit.
  - status signal: "💩 **Read `renderSpecBookTab` (@17190)** and report"
  - owner: Cursor
  - blocker: none stated

- **Optional PDF capture durability §8** | source: `Docs/ESPEC_BOOK_BUILDER_BRIEFING_MH_Aug11_v2.1.md` | date: Aug 11
  - what: Download and store vendor PDFs on product for offline permanence.
  - status signal: "later, NOT v1"
  - owner: unstated
  - blocker: deferred by design

### Aug 12 context / skills (Dropbox mirrors; project originals unread)

- **WO-STUDIO-STATE-DOC output** | source: `Dropbox/.../WO-STUDIO-STATE-DOC_C-Team_Aug12_v1.0.md` | date: Aug 12
  - what: Produce `Docs/CCH_STUDIO_CURRENT_STATE_CR_Aug12_v1.0.md` from live code.
  - status signal: "Produce ONE current, accurate markdown document"
  - owner: Cursor
  - blocker: v1.0 exists in Docs; C-Team v1.1 in Dropbox has "Two minor items left" §9

- **CCH_STUDIO_CURRENT_STATE unknowns** | source: `Dropbox/.../CCH_STUDIO_CURRENT_STATE_C-Team_Aug12_v1.1.md` | date: Aug 12
  - what: Confirm Showrooms/Subcontractors backing data and QB update-existing path.
  - status signal: "Two minor items left (not blockers)"
  - owner: Cindy
  - blocker: none stated

- **Client visibility OPEN CONFIRM** | source: `loop/LOOP_LEDGER.md` (Aug 07 standing rule) | date: Aug 07
  - what: Confirm Room Boards / Documents / Updates stay client-visible.
  - status signal: "OPEN CONFIRM: Room Boards / Documents / Updates"
  - owner: Cindy
  - blocker: decision not recorded

### Money / data integrity (local debug only; project docs unread)

- **Bugle Trail missing POs** | source: `_debug/bugletrail-po-reconcile-dryrun-report.json` | date: Aug 04
  - what: 44 Houzz POs missing in Studio including PO-400024 $34972.76, PO-400025 $17098.37, PO-400026 $5964.03, PO-400027 $2080.00, PO-400028 $2000.00, PO-400029 $7426.30, PO-400030 $3833.87 (44 total `wouldCreate`).
  - status signal: "reason": "Missing in Studio purchaseOrders"
  - owner: unstated
  - blocker: dry-run only; no apply confirmation in repo

- **WO-045 durability switch** | source: `loop/LOOP_LEDGER.md` | date: Jul 27
  - what: Default-on `_cchDocLineClipEnsureApply` so new doc lines keep creating clips.
  - status signal: "Durability switch still OFF (needs WO)"
  - owner: Cursor
  - blocker: folded into WO-113 Part 2

- **WO-058 retest on prod** | source: `loop/LOOP_LEDGER.md` | date: Jul 23
  - what: Emtek suppression retest after prod rules deploy (gate for ongoing 045 writes).
  - status signal: "Retest Emtek"
  - owner: Fable
  - blocker: none stated

### WO files in user list but not in local `loop/` (status unknown; treat OPEN until verified)

- **WO-095 starred icon** | source: `claude/WO-095_starred-star-icon-rendering-as-question-mark_CW_Aug06.md` | date: Aug 06
  - what: Star icon renders as question mark.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: none stated

- **WO-088-B finish picker** | source: `claude/WO-088-B_builder-finish-picker-from-finish-library_CW_Aug05.md` | date: Aug 05
  - what: Builder finish picker from finish library.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: ledger notes "085 / 087 / 088-B stay Code/heavy"

- **WO-096-098 Timely/Smart Time naming** | source: `claude/WO-096-098_timely-smarttime-portal-naming_CW_Aug06.md` | date: Aug 06
  - what: Timely / Smart Time / portal naming alignment.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: none stated

- **WO-102 vendor reply ingest** | source: `claude/WO-102_vendor-reply-ingest-and-po-reconciliation_CW_Aug08_v1.1.md` | date: Aug 08
  - what: Vendor reply ingest and PO reconciliation.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: note: Pepper plan held WO-102/103 for Desktop voice steps (different WO-102 context)

### Marketing / brand lane (project-only; unread)

- **MARKETING_LANE_HANDOFF** | source: `claude/MARKETING_LANE_HANDOFF_MH_Jul16_v1.0.md` | date: Jul 16
  - what: Marketing deliverables handoff.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: none stated

- **CCH_DESIGN_BIBLE / BRAND_BOOK / RH_JOBSITE / TRADE postcards** | source: user list Jul 12–16 | date: Jul 12–16
  - what: Brand/marketing asset production threads.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: none stated

### FABLE decisions (implementation unconfirmed unless ledger says DONE)

- **proposal-to-rooms** | source: `claude/FABLE_DECISION_proposal-to-rooms_CW_Jul24_v1.0.md` | date: Jul 24
  - what: Decision recorded; coordinated WO/scoping status unknown.
  - status signal: project-only, unread
  - owner: Fable
  - blocker: none stated

- **studio-staff-chat** | source: `claude/FABLE_DECISION_studio-staff-chat_CW_Jul27_v1.0.md` | date: Jul 27
  - what: Decision B shipped as WO-063; full feature scope vs decision unknown.
  - status signal: ledger: WO-063 "DONE-UNVERIFIED"
  - owner: Cursor
  - blocker: none stated

- **pepper-features** | source: `claude/FABLE_DECISION_pepper-features_CW_Jul26_v1.5.md` | date: Jul 26
  - what: Pepper feature scope decision; partial MVP only (062/104/105).
  - status signal: project-only, unread
  - owner: unstated
  - blocker: none stated

### Safety nets / canary (project-only; partial from local)

- **CANARY_RUNBOOK steps** | source: `claude/CANARY_RUNBOOK_CW_Aug04.md` | date: Aug 04
  - what: Canary whitelist for extension noise (`inpage.js`, `ERR_BLOCKED_BY_CLIENT`) noted in WO-069-B FINDING; full runbook unread.
  - status signal: "MUST whitelist these"
  - owner: unstated
  - blocker: project-only

- **CCH_STUDIO_SAFETY_NETS_PLAN** | source: `claude/CCH_STUDIO_SAFETY_NETS_PLAN_CW_Aug03_v1.1.md` | date: Aug 03
  - what: Proposed safety nets; implementation status unknown.
  - status signal: project-only, unread
  - owner: unstated
  - blocker: none stated

### Skill audit (project-only)

- **CCH_SKILL_AUDIT v1.0/v1.1** | source: `claude/CCH_SKILL_AUDIT_C-Team_Aug12_v1.1.md` | date: Aug 12
  - what: Skill rebuild audit against current state doc.
  - status signal: project-only, unread
  - owner: C-Team
  - blocker: none stated

## CLOSED (for dedupe)

- **WO-112 Smart Time source split** | `loop/WO-112_DONE_CR_Aug13.md` | Timely/Agent/Logged in Recon Month+Week | staging **9.9.162** Aug 13 *(moved from OPEN morning audit)*
- **WO-DRAFT-A variance breakout** | `loop/WO-DRAFT-A_DONE_CR_Aug12.md` | Parent/child variance components + tax guard | "**PROD** v9.9.151" / DONE Aug 12
- **WO-067 invoice AI summary** | `loop/LOOP_LEDGER.md` | Summarize + CCH voice | "**PROD** v9.9.86"
- **WO-068 formatted notes portal** | `loop/LOOP_LEDGER.md` | Notes tab + publish | "DONE-UNVERIFIED" prod 9.9.82–84
- **WO-069-B / WO-070** | `loop/LOOP_LEDGER.md` | Builder picker + All Tasks sort | "**PROD** Aug 3"
- **WO-075-B through WO-078** | `loop/LOOP_LEDGER.md` | Builder print + pagination | "DONE-UNVERIFIED" / prod
- **WO-082–086, 089–093** | `loop/LOOP_LEDGER.md` | Aug 5–7 platform batch | "DONE-UNVERIFIED"
- **WO-104 client Pepper greeting** | `loop/WO-104_DONE_CR_Aug09.md` | Open-items auto-open | "**PROD** 9.9.124"
- **WO-105 staff agenda MVP** | `loop/WO-105_DONE_CR_Aug09.md` | Morning brief + preset | "**PROD** **9.9.125**"
- **WO-108 person filter** | `loop/WO-108_DONE_CR_Aug10.md` | Activity Feed chips | "**9.9.135**" prod Aug 10
- **WO-099 training label** | code `cch-client-pepper.js:622` | "Design assistant in training ;-)" | in repo; deploy with 086/089 batch
- **Smart Time glyph fix 9.9.159** | `_DEPLOY_QUEUE.md` | CCH_UI escape placeholders | bundled **9.9.160** staging Aug 13
- **WO-058 VERIFY PASS** | `loop/LOOP_LEDGER.md` | Houzz-proof unassign + suppressions | "WO-058 VERIFY = PASS"
- **WO-059 prod promote 9.8.108** | `loop/LOOP_LEDGER.md` | clipSuppressions rules prod | "DONE + PROD-VERIFIED"
- **WO-045 RH prod apply** | `loop/LOOP_LEDGER.md` | Clips 458→579 | "PROD APPLY" Jul 27
- **WO-064 heal duplicate IDs** | `loop/LOOP_LEDGER.md` | db64 | "VERIFIED*"
- **WO-065 auto-save after heal** | `loop/LOOP_LEDGER.md` | db65 quiet save | "DONE-UNVERIFIED"
- **Spec Book wizard partial** | `_DEPLOY_QUEUE.md` | Steps 1–4, invoice source, staging 9.9.153–158 | "STATUS: done (staging)"
- **E-Spec landing `#/especs`** | `_DEPLOY_QUEUE.md` | Project picker | "STATUS: done"
- **Aug 12 context doc** | `Docs/CCH_STUDIO_CURRENT_STATE_CR_Aug12_v1.0.md` | Canonical state doc exists locally
- **READ-FIRST Vanessa** | Dropbox mirror | Plain-language onboarding | informational, not a WO

## NOTES

- **`Projects` / `project_read` unavailable** in this Cursor environment. No MCP server exposes Claude.ai project file reads. Audit reconciled from `loop/LOOP_LEDGER.md`, `loop/WO-*`, `_DEPLOY_QUEUE.md`, `Docs/ESPEC_*`, Dropbox mirrors of Aug 12 C-Team docs, and code spot-checks (Aug 13).
- **`CCH_WO_STATUS_BOARD_CW_Aug06.html`**: not read; full per-WO Aug 06 table cannot be reproduced here.
- **`VERIFICATION_LEDGER_CW_Jul30.md`**: not read; partial table above from ledger log only.
- **WO-101 number collision**: two different work orders share **WO-101** in the user list: (1) `WO-101_pepper-desktop-shell-pwa` in local `loop/`; (2) `WO-101_pepper-follow-up-loops-po-and-client` project-only. Pepper Desktop plan also references WO-102/103 for voice/persona, separate from vendor-reply **WO-102** in the Aug 08 batch.
- **WO-102 naming collision**: Pepper Desktop track WO-102 = voice loop; Aug 08 `WO-102_vendor-reply-ingest` = different feature. Treat as distinct threads.
- **Ledger vs WO file headers**: many Aug 5–7 WO files still say "State: OPEN" in headers while ledger marks DONE-UNVERIFIED (082–093). **Ledger + DONE_CR + deploy queue supersede stale file headers.**
- **WO-069-B chain**: cost-on-line fixed in `ft028c` and prod per ledger; FINDING doc optional canary/deep assert not confirmed closed in any local doc.
- **WO-067_VERIFY_FAIL**: no local copy; ledger shows WO-067 DONE prod Aug 3, treating verify fail as resolved unless project doc says otherwise.
- **WO-058_VERIFY_FAIL**: resolved by WO-058b PASS per ledger Jul 23.
- **Bugle Trail PO recon v1.0 vs v1.1**: only `_debug/bugletrail-po-reconcile-dryrun-report.json` local; project markdown versions unread. Dry-run shows 44 missing POs; no apply report in repo.
- **`QB_HOUZZ_MISSING_INVOICES_RESOLVED_MH_Jul13.md`**: project-only; cannot confirm whether filename "RESOLVED" closed all items or left residuals.
- **E-Spec Book**: staging has substantial wizard (9.9.153–158 deploys) but v2.1 briefing deltas (productDocs, N-up Reece modal, token share, CF PDF) remain open per code grep Aug 13.
- **Pepper Master Plan v1.4**: project-only; v1.0–v1.3 unread. Local evidence: Phase 0 WO-100 open; WO-106/110/111 open; WO-104/105 MVP closed prod.
- **Aug 12 skill audit docs**: project-only; Dropbox has platform overview HTML and Vanessa helper skill but not the audit markdowns.
- **Contradiction watch**: LOOP_LEDGER log Aug 7 says ledger "behind" on 094/095/096; ledger now has 094 OPEN but still no rows for 095/096/088-B/102/110/111/112/113.
- **This file** is the canonical saved copy of the morning chat audit. Upload to Claude Team project knowledge alongside the HTML board.
