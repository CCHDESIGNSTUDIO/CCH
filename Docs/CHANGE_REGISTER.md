# CCH Change Register

**Started:** July 9, 2026  
**Owner:** #1 (Deploy Master) assigns the next ID on every deploy handoff.

Use this file to answer **“where are we on #FT-003?”** — one row per shipped or in-flight change.

Older IDs in `KNOWN_ISSUES.md` (e.g. `RB-3`, `F-131`, `DB-1`) stay valid for historical bugs; **new work from Jul 9, 2026 onward uses `BF-###` / `FT-###` here.**

---

## ID format

| Prefix | Meaning | Example |
|--------|---------|---------|
| **BF-###** | Bug fix | BF-001 — invoice service line TAG mislabel |
| **FT-###** | Feature / enhancement | FT-001 — Custom Builder Phase 3 |

- Numbers are **sequential per prefix** (never reuse).
- **#1** assigns the ID when processing the deploy queue (or when a session opens a tracked item).
- Every `_DEPLOY_QUEUE.md` handoff must include the ID: `FT-001` in the description line.
- Status: `pending` → `staging` → `production` (or `deferred` / `cancelled`).

---

## Register

| ID | Date | Area | Summary | Staging | Production |
|----|------|------|---------|---------|------------|
| **FT-046** | 2026-08-15 | Client Pay | Square hosted checkout link + Zelle instructions on one portal Pay page; Open invoice one Pay button. Loop **WO-114**. Studio **9.9.204**. No in-app card fields; QB remains payment SoT. | **done** (staging) | **done** (prod Aug15 Cindy GO) |
| **FT-045** | 2026-08-03 | Custom Builder | WO-075-B four: PROJECT bigger; Vendor→Part#→color; Materials narrower; bottom details larger; Approval raised (no flex-grow gap). Meta `2026-08-03ft045-wo075b-four`. Loop **WO-075-B**. | **done** (staging ~18:35) | **done** (prod ~19:05) |
| **FT-039** | 2026-08-03 | Custom Builder | Approval footer one line: Designer (left) · Client (center) · Workroom (right). Loop **WO-075-B**. | **done** (staging) | **done** (prod ~19:05; rev ft045) |
| **FT-038** | 2026-08-03 | Custom Builder | Product print punchlist (dims/QTY/tag/footer/Letter landscape). Loop **WO-075-B**. | **done** (staging) | **done** (prod ~19:05; rev ft045) |
| **FT-037** | 2026-08-03 | Custom Builder | Dims under Specs + Letter landscape preview. Loop **WO-075-B**. | **done** (bundled) | **done** (prod ~19:05; rev ft045) |
| **FT-036** | 2026-08-03 | Custom Builder | Detail images (Stitch/Nailheads/Feet/Furniture) full page-width row under layout, larger. Meta `2026-08-03ft036-detail-full-bleed`. Loop **WO-074-B**. | **done** (staging ~14:52) | **done** (prod ~14:55) |
| **FT-035** | 2026-08-03 | Custom Builder | Product print type: smaller/quieter yardage badge; larger Design Specs. Meta `2026-08-03ft035-yards-specs-type`. Loop **WO-073-B**. | **done** (staging ~14:40) | **done** (prod ~14:55; rev ft036) |
| **FT-034** | 2026-08-03 | Custom Builder | Compact Where it goes (1-line) + no empty print DETAILS + short image Note. Loop **WO-073-B**. | **done** (staging; rev now ft035) | **done** (prod ~14:55; rev ft036) |
| **FT-033** | 2026-08-03 | Custom Builder | Feet upload when library empty + print detail strip full-width (2–4 thumbs) + compact image Description. Meta `2026-08-03ft033-feet-detail-row`. Loop **WO-072-B**. | **done** (staging ~14:25) | **done** (prod ~14:55; rev ft036) |
| **FT-032** | 2026-08-03 | Custom Builder | COL print clean: numeric COL → badge (`45 SF`); prose → Coverage note; no double SF. Bundle meta `2026-08-03ft032-col-print-clean`. Loop **WO-071-B**. | **done** (staging ~13:25) | **done** (prod ~14:55; rev ft036) |
| **FT-031** | 2026-08-03 | Custom Builder | Print: location on COM A heading only (`fabricPreviewHeading`); no duplicate Where it goes under swatch. Loop **WO-071-B**. | **done** (staging ~13:25) | **done** (prod ~14:55; rev ft036) |
| **FT-030** | 2026-08-03 | Custom Builder | Upholstery workroom cost lines: Labor · Nailhead · Trim · Other expense · Installation · Shipping; remove Panel/Hardware/Lining for upholstery only. Loop **WO-071-B**. | **done** (staging; rev now ft032) | **done** (prod ~14:55; rev ft036) |
| **FT-029** | 2026-08-03 | Custom Builder | Per-material **Where it goes** textarea on upholstery WO. Loop **WO-071-B**. | **done** (staging; rev now ft032) | **done** (prod ~14:55; rev ft036) |
| **FT-018** | 2026-07-27 | Staff chat | One firm Studio thread (Cindy↔Vanessa); optional project tag → admin activity only; sidebar badge; Team FAB Chat\|Bugs. Loop **WO-063**. | **done** (staging) | **done** (prod v9.9.21) |
| **FT-017** | 2026-07-26 | Custom Builder | Browse all work orders (firm-wide) in Builder — Open/Duplicate without picking a project first. Rev `2026-07-26ft025-all-work-orders`. | pending | — |
| **FT-016** | 2026-07-23 | Custom Builder | Update proposal from WO + multi-select WOs for one proposal + close-out status. Loop **WO-054-B**. | pending | — |
| **FT-015** | 2026-07-21 | Custom Builder | Bedding WO: room-level multi-line + Option 1–3 tabs (Shimano shape). Loop **WO-053-B**. | **done** (staging ft016 Jul22; ledger DONE-UNVERIFIED) | pending verify |
| **FT-014** | 2026-07-21 | Custom Builder | Pillow spec block: Type / Qty / Size / Style / Closure / Insert / Trim chips + Notes. Loop **WO-052-B**. | **done** (staging ft016 Jul22; ledger DONE-UNVERIFIED) | pending verify |
| **FT-013** | 2026-07-21 | Custom Builder | Application free-text per Material A–D (Parsons fabric-role gap). Loop **WO-051-B**. | **done** (staging ft016 Jul22; ledger DONE-UNVERIFIED) | pending verify |
| **FT-012** | 2026-07-21 | Custom Builder | Collapsible form sections + localStorage remember. Loop **WO-050-B**. | **done** (staging ft016 Jul22; ledger DONE-UNVERIFIED) | pending verify |
| **BF-009** | 2026-07-21 | Custom Builder | Create Proposal / Add Fabrics: material PRICE/TOTAL $0 — widen library price aliases in `buildProposalMaterialLinesFromWorkOrder`. Loop **WO-049-B**. | **done** (staging ft016 Jul22; ledger DONE-UNVERIFIED) | pending verify |
| **FT-011** | 2026-07-09 | Inspiration boards | Board list tiles show ★/💬 counts; project landing activity bar; Inspiration tab badge; Overview feedback card. Build v9.8.50. | **done** (staging) | pending |
| **BF-008** | 2026-07-09 | PO shipping | At Receiver / At Workroom: auto-use Ship to when `po.receiver` empty (e.g. Designers Moving Service); no modal prompt. `cchPoResolveReceivingLocation`. Cache `poc23`. | **done** (staging) | pending |
| **FT-010** | 2026-07-09 | Project overview layout | Dedupe proposals/invoices (expandable Action required); Recent Activity above Team/Pinterest; type scale tokens; Selections verified (clips); Inspiration preview label. | **done** (staging) | pending |
| **BF-007** | 2026-07-09 | Invoice Print/PDF | Design-services sheet: footer pinned bottom on print; Paid/payment rows + Balance Due in totals. Cache `ds10` + `invds10`. Balance Due matches total-row typography. | **done** (staging + prod) | **done** |
| **FT-008** | 2026-07-09 | Financial Health | v5 tile layout: two 6-tile rows, colored top bars, Design Fees + fee-stream leakage; build v9.8.49. | **done** (staging + prod) | **done** |
| **BF-006** | 2026-07-09 | Invoice nav | Stale async render guard: breadcrumb/project mismatch when switching invoices quickly (Greene vs Holtz). | **done** (staging + prod) | **done** |
| **BF-005** | 2026-07-09 | Edit Project | Client CRM link: pick client record by id; save clientId + clientCompany; business billing uses company name; CRM typeahead; scrubbed-name bypass; save error toast. | **done** (staging + prod) | **done** |
| **BF-004** | 2026-07-09 | Invoice | Design-services invoice: restore project address (job site) under Project column. Rev `20260709ds6`. | **done** (staging) | pending |
| **FT-007** | 2026-07-09 | Custom Builder | Vendor fabrics: library + upload moved into Materials; swatch apply sets Vendor source + SKU; Add fabric/trim button fix; per-row vendor library picker. Rev `2026-07-09ft007-vendor-fabric-materials`. | **done** (staging) | **done** |
| **FT-006** | 2026-07-09 | Custom Builder | Remove tables from Custom Upholstery (piece list, table details, dining-table intent). Rev `2026-07-09ft006-no-upholstery-tables`. | **done** (staging) | **done** |
| **FT-005** | 2026-07-09 | Custom Builder | Upholstery: single Finish (Details + image); consolidated Nailheads section with A/B fields + reference image. Rev `2026-07-09ft005-upholstery-finish-nailhead`. | **done** (staging) | **done** |
| **FT-004** | 2026-07-09 | Custom Builder | Generic workroom estimate PDF import (QB PO/invoice/budget); vendor from Workroom dropdown; COM vs workroom fabric; UI renamed from Bartolo-specific labels. Rev `2026-07-09ft004-workroom-pdf-import`. | **done** (staging) | **done** |
| **BF-003** | 2026-07-09 | Platform auth | Staging login broken: duplicate `_timeVal` in `renderOverviewTab` (BF-002) caused script parse error. Build v9.8.47. | **done** (staging) | — |
| **FT-003** | 2026-07-09 | Custom Builder | Upholstery spec library routing (chair/sofa/legs/finish/welt); vendor vs COM fabric toggle + preview labels; side rail syncs to furniture libs. Rev `2026-07-09ft003-upholstery-spec-com`. | **done** (staging) | — |
| **FT-001** | 2026-07-09 | Custom Builder | Phase 3 — Parsons/Promontory upholstery WO blend. Rev `2026-07-09ft001-bld-phase3`. | **done** | — |
| **BF-002** | 2026-07-09 | Projects / Financial Health | Single `computeProjectFinancials()` source; waterfall card; sent-invoice filter; Overview KPI + Open Invoices aligned. Build v9.8.46. | **done** (staging) | — |
| **BF-001** | 2026-07-08 | Invoice | Service-line TAG inference fix (time/DS invoices); Manage/Preview parity — *backfilled, shipped prod Jul 8* | done | done |
| **FT-002** | 2026-07-08 | Client portal | Documents: all project files, no approval gates; Decisions card grid — *backfilled, shipped prod Jul 8* | done | done |

**Next available:** `BF-010`, `FT-047`

---

## For agents (handoff template)

```
[YYYY-MM-DD HH:MM] #<session> FT-00N — <files> — staging — <one-line> — STATUS: pending
```

#1 adds the row to this register, deploys, then updates Staging/Production columns.
