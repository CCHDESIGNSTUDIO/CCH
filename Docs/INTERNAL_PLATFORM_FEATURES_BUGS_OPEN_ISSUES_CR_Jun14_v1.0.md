# CCH Studio — Features, Bugs & Open Issues Report

**File:** INTERNAL_PLATFORM_FEATURES_BUGS_OPEN_ISSUES_CR_Jun14_v1.0.md
**Original Author:** Cursor (CR)
**Created:** June 14, 2026
**Last Modified:** June 26, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.2
**Status:** Snapshot report. For scheduling, `CURRENT_PRIORITIES.md` wins; for live regressions, `KNOWN_ISSUES.md` wins.

## Revision history

- v1.0 (Jun 14, 2026, CR): Initial consolidated inventory. Grounded in the in-app Platform Status map (`platform/index.html` `renderPlatformStatus`, lines 57594–57728), `KNOWN_ISSUES.md` (Jun 8), `CURRENT_PRIORITIES.md` (May 27 rev), `INTERNAL_CURRENT_PLATFORM_STATUS_CR_Jun09_v1.0.md`, and the Jun 13–14 design-board/proposal session.
- v1.1 (Jun 25, 2026, CR): Added **Part 6 — PO ship/pay two-lane model** (deploy backlog item) from the PO-9017 partial-ship-vs-partial-paid analysis. Captured as a target model; current-code claims tagged for grounding before implementation.
- v1.2 (Jun 26, 2026, CR): Added **Part 7 — Legacy PO balances wrong (shipping/tax)**. NOTE: a Jun 26 bulk-close of 175 **Studio** POs was a mistake (only Houzz should be closed) and was **reverted the same day** — all 175 restored to prior status. Part 7 retains the underlying shipping/tax balance issue to revisit.

---

## How to read this

Three things, in three places, on purpose:

1. **Features** — what exists and its maturity (done / partial / bug / planned). Grounded in the in-app **Platform Status** page (`renderPlatformStatus`, `index.html:57602–57728`), which is the live, admin-only feature map.
2. **Bugs** — confirmed defects in shipped features. Merged from the in-app map's `bug`-flagged rows and the tracked regressions in `KNOWN_ISSUES.md`.
3. **Open issues / priorities** — work not yet built or not yet shipped, from `CURRENT_PRIORITIES.md` plus the Jun 5 intake in `KNOWN_ISSUES.md`.

Status legend (from the in-app map): ✅ Done · 🔶 Partial · 🐛 Bug · 🔴 Open · 📋 Planned.

---

## PART 1 — FEATURE INVENTORY

Source: `index.html` `renderPlatformStatus()` master feature map. Each section below mirrors a card on the in-app Platform Status page (admin-only, "Submit Bug →").

### Dashboard
| Feature | Status | Note |
|---|---|---|
| Owner Dashboard | ✅ | Financial health, project summary, KPIs |
| Vanessa Contractor Dashboard | ✅ | Productivity, revenue impact, fee alerts |
| What's New Widget | ✅ | Links to Release Notes + Bug Tracker |
| Daily Design Inspiration Feed | 📋 | Curated design news/trends |
| Unlogged Time Alerts | ✅ | Days with captures but no logged time |

### Projects
| Feature | Status | Note |
|---|---|---|
| Project List (Grid/List) | ✅ | Sortable, filterable, search |
| Project Detail Overview | ✅ | Financials, time, selection boards |
| Edit Project Modal | ✅ | Client dropdown, address, fee, status |
| Client Auto-Lookup | ✅ | From clients collection |
| Financial Health Bar | ✅ | Cash/loaded profit, efficiency, fee burn |
| Pinterest Board Embed | ✅ | Link any Pinterest board URL |
| Files & Attachments | ✅ | Upload or link URLs per project |
| Client Portal Preview | 🔶 | Basic view — needs polish |
| Project Tabs | ✅ | Overview, Tasks, Ideabooks, Room/Design Boards, FFE, Proposals, Invoices, POs, Financials, Time, Comms, Notes |

### Selections / FFE
| Feature | Status | Note |
|---|---|---|
| Selection Grid/List View | ✅ | Room-grouped product cards |
| Product Detail Modal | ✅ | Edit title, vendor, price, room, images |
| Room Boards | ✅ | Visual room-based grouping |
| Category Boards | ✅ | Category-based grouping |
| FFE Tracker | ✅ | Full FFE schedule with status |
| Search Selections | 🐛 | Cursor jumps out of search box |
| Delete Items from Boards | 🐛 | No delete button on room/ideabook items |

### Proposals
| Feature | Status | Note |
|---|---|---|
| Proposals List | ✅ | Sortable table |
| Time Period Filters | ✅ | Week / Month / YTD / All |
| Stat Cards | ✅ | Proposed, Approved, Paid, Invoiced |
| Proposal Detail/Edit | ✅ | Full editor with line items |
| Proposal → Invoice Link | ✅ | Tracks conversions |
| Numbering (PRO-3000+) | ✅ | Auto-increment from docCounters |
| **Board → Proposal room inherit** | ✅ | **NEW Jun 14** — see Part 4 |
| **Bulk: Set room for all lines** | ✅ | **NEW Jun 14** — see Part 4 |

### Invoices
| Feature | Status | Note |
|---|---|---|
| Invoices List | ✅ | Sortable with payment status |
| New Invoice Modal | ✅ | Auto-number INV-6000+, line items |
| Invoice Status Flow | ✅ | Draft → Sent → Paid / Overdue |
| Invoice Edit/View Split | ✅ | Edit = line items · View = totals/QB/client |
| QuickBooks Sync | ✅ | qbWebhook Gen2; balance sync jobs |
| Payment Tracking | 🔶 | Manual + qbWebhook auto-clear (two-state) |
| Houzz Payment Import | 🔶 | Mostly applied; spot-fix IN-10145/10151/10159 |
| Firm-wide invoice dedup | 🔶 | 179 dupes merged; ~20 boards w/ case-variant pairs |

### Purchase Orders
| Feature | Status | Note |
|---|---|---|
| PO List | ✅ | Sortable with vendor/status/amount |
| New PO Modal | ✅ | Quick create |
| Numbering (PO-400000+) | ✅ | Auto-increment |
| PO → Bill → QB (bill-only) | ✅ | Shipped May 28; vendor bill captures actuals |
| PO lock after Send | ✅ | Total/items immutable once sent |
| PO Detail Page | 🔶 | Classic theme shows black boxes |
| PO Variance / Discrepancy Report | 📋 | Per `SPEC_PO_Bill_Variance_Workflow_v1.0.md` |

### Smart Time
| Feature | Status | Note |
|---|---|---|
| Desktop Agent (v4) | ✅ | Captures every 15s, flush every 5min |
| Timeline / List / Week views | ✅ | Day timeline, list, Mon–Fri week |
| Date Picker / Member Selector | ✅ | Jump dates; admin views Vanessa |
| Noise Filter | ✅ | Snipping Tool, Explorer filtered |
| Service Type Suggestions | ✅ | SketchUp→Design, Houzz→Procurement |
| Teams/Zoom Detection | ✅ | Meeting titles from window name |
| UTC Timezone Fix | ✅ | UTC→local date correct |
| Capture Consolidation | 🐛 | Overcounting (Campco 1.25hr for 14min) |
| Ghost Block | 🐛 | Logged time shows as capture in timeline |
| Delete in List View | 🐛 | Delete button missing/unwired |
| Batch Editing / AI Auto-Draft / Time→Invoice | 📋 | Planned pipeline |

### Team & Contacts
| Feature | Status | Note |
|---|---|---|
| Contact Card Grid | ✅ | Roles, rates, email, phone |
| Add/Edit/Delete Modal | ✅ | Full CRUD with linked projects |
| Role Filter | ✅ | Owner, Contractor, Sub, Workroom, Vendor, Architect |
| Auto-Import from Vendors | ✅ | Vendors merged into team view |
| Quick Actions (Call/Email/Text) | ✅ | tel:/mailto:/sms: |

### Clients
| Feature | Status | Note |
|---|---|---|
| Client List | ✅ | Aggregated from project clientName |
| Client → Project Association | 🔶 | 47 clients, 26 projects linked |
| Client Detail Page | 📋 | Full profile planned |
| Add to Project Button | 📋 | Planned |
| Client Search Cursor | 🐛 | Cursor jumps out (same class as Selections) |

### Vendors
| Feature | Status | Note |
|---|---|---|
| Vendor List + Search | ✅ | Sortable with tags, product counts |
| Vendor Detail (4 tabs) | ✅ | Products, POs, Invoices, Info |
| PO Filtering | ✅ | By vendor name |
| Products Tab | 🐛 | Jumps to Design Hub instead of vendor products |

### Inspiration (Ideabooks)
| Feature | Status | Note |
|---|---|---|
| Ideabook Grid | ✅ | Visual boards with covers |
| Lightbox View | ✅ | Full-screen viewer, stars, comments |
| Star/Comment Readability | 🐛 | Text invisible on dark background |
| Delete Items | 🐛 | No delete button on ideabook items |

### Communications
| Feature | Status | Note |
|---|---|---|
| 5-Part Unified Feed | ✅ | Correspondence, Messages, Notes, Updates, Activity |
| Log Correspondence Modal | ✅ | Email, call, text, meeting, change order |
| Team Contact Autocomplete | 📋 | From/To from team collection |
| Outlook Email Integration | 📋 | MS Graph API |
| Text/SMS Logging | 📋 | Quick-log texts |

### Theme & UI
| Feature | Status | Note |
|---|---|---|
| Studio Dark Theme | ✅ | Navy/Gold/Cream |
| Color Palette Cleanup | ✅ | Navy/gold/cream only |
| Classic White Theme | 🔶 | Some pages still have dark boxes |
| Responsive Layout | 🔶 | 1200px+ works; mobile needs polish |

### CCH Clipper (Chrome Extension)
| Feature | Status | Note |
|---|---|---|
| Clip Products to Projects | ✅ | Right-click from any site |
| Save Source URL | 🐛 | Not saving source link on add to ideabooks |
| Clear Images Between Pages | 🐛 | Old images persist on navigate |
| Right-Click Clip | 🐛 | Can't right-click images to clip |

### Design Boards (Canva-style editor)
Maintained in the external module `platform/cch-design-board.js` (not in the in-app map above). Current build stamp series `db##`; latest production deploy Jun 14 (see Part 4 + session log).
| Feature | Status | Note |
|---|---|---|
| Incremental drag/render | ✅ | translate3d, will-change; replaced full re-render |
| Unstick (UI reset) | ✅ | "Nuclear unstick" reset |
| Cost Summary panel (estimate) | ✅ | Client/internal toggle; print with images |
| Print / Export menu | ✅ | Print board / cost summary; PNG hardened |
| New Product from board image | ✅ | Nudge → New Product modal |
| Board → Proposal (auto PRO#, room inherit) | ✅ | Jun 14 |
| Room picker (board + proposal) | ✅ | Project rooms dropdown + type-in |
| Desktop drag-drop to canvas | 🐛/📋 | KNOWN_ISSUES DB-1 |
| Room filter on left sidebar | 🐛/📋 | KNOWN_ISSUES DB-2 |
| Inspiration tab pull-in | 🐛/📋 | KNOWN_ISSUES DB-3 |

### Data & Imports
| Feature | Status | Note |
|---|---|---|
| Houzz Product Import | ✅ | Tracker-spreadsheet import (taxonomy-guarded) |
| Client Extraction | ✅ | 47 clients from Houzz files |
| Houzz Transaction Report | 🔶 | Parsed, not fully reconciled |
| Houzz Payment Import | 🔴 | $11.3M parsed — push to invoice records |

---

## PART 2 — BUGS (confirmed defects in shipped features)

### A. In-app bug-flagged (from Platform Status map)
| Area | Bug |
|---|---|
| Selections | Search box cursor jump; no delete button on room/ideabook items |
| Smart Time | Capture overcounting; ghost block; list-view delete missing |
| Clients | Search cursor jump |
| Vendors | Products tab routes to Design Hub |
| Inspiration | Star/comment text unreadable on dark; no delete button |
| Clipper | Source URL not saved; images don't clear between pages; right-click clip broken |

### B. Tracked regressions (from `KNOWN_ISSUES.md`, Jun 8)
| # | Area | Issue | Status |
|---|---|---|---|
| DB-1 | Design Board | Desktop drag-drop to canvas not working | Open — fix in `openDesignBoard()` |
| DB-2 | Design Board | Left-sidebar Room filter missing | Open |
| DB-3 | Design Board | Inspiration pull-in empty | Open |
| RB-1 | Room Board | Decline triggers "New clips detected" refresh; appears not to save | **Fixed on staging** (self-write suppression) — awaiting prod sign-off |
| RB-2 | Room Board | Approve/Decline doesn't sync room-board ↔ proposal line | **Root fix on staging** (pending can't overwrite explicit) — full write-back deferred per Cynthia |
| SEL-1 | Selections | Category/Edit-modal edits don't persist for library/products/Houzz rows | Open — decision pending (library APPLY vs find-or-create vs read-only) |

> Note: the **proposal room not filling** issue raised this session is **resolved** (Part 4). It was not a code defect in the write path; it was the older double-prompt flow plus a per-line dropdown match. Both addressed.

---

## PART 3 — OPEN ISSUES & PRIORITIES

Source: `CURRENT_PRIORITIES.md` (May 27 rev) + `KNOWN_ISSUES.md` Jun 5 intake. Ordered as in the priority file.

### HIGH — active UI regressions
1. **Design Board — restore Morpholio/Canva behaviors** (DB-1/2/3 above): desktop drag-drop, room filter, inspiration pull-in. Fix in `openDesignBoard`.
2. **PO → Bill → Client Invoice variance workflow + Discrepancy Report** (3b). Core bill-only path shipped; remaining = discrepancy tab/report/dashboard + client-invoice routing + spec sync.
3. **BIG QuickBooks push notifications** (3a): modal on first push, full-width sync banner, sticky toast stack; hook qbWebhook + balance-sync paths; red failure states.

### HIGH — architectural
4. **RESOLVE vs APPLY pattern** (AI Session Rule #3) — replace `applyLibraryImageSyncToDocItems`, `ensureLibraryProductsForLineItems`, `syncImageFromLibrary` (auto-persist overwrite bug class).
5. **Restore Product Library UI** lost in May 13 revert (`bc5175c`): Houzz ID in modal header, LINKED column popover, three-column LINKED section.
6. **Re-add Replace Image button** on product edit (must UPDATE, not CREATE).
7. **Categories regression** — design services/expenses leaking into Product Library + Selections dropdowns; filter `expenseType: service|expense`.

### Agent layer (approved May 27 — multi-session builds)
- **Chief of Staff Agent v1.0** (3c) — `SPEC_Chief_Of_Staff_Agent_v1.0.md`; first win = daily briefing modal.
- **CFO Agent v1.0** (3d) — `SPEC_CFO_Agent_v1.0.md`; AR aging widget + daily cash snapshot first.
- **CMO / Client Experience Agent v1.0** (3e) — `SPEC_CMO_Agent_v1.0.md`; silence detection + engagement scorecard first.

### MEDIUM (triaged from feedbackRequests + cleanup)
- Client searchbar cursor jump (input-layer fix, shared with Selections search).
- Smart Time Chrome overcounting (Campco) — `CCH-TimeAgent.ps1` aggregation.
- Smart Time list delete unwired.
- Activity page rendering empty — verify on prod.
- Remove 11 service/expense rows from Product Library; fix `Appliances  & Plumbing` double-space (14 docs).
- **Tearsheets page blank** (fix).
- Connect product image slots 2–5 via `images[]` (9,579 orphaned `houzz-products/<id>/{2..5}` files).
- Apr 29 save issue — `_enrichedFromHouzzApr27` / `_categoryFixedAt` possibly causing silent save failures.

### NICE-TO-HAVE
- Triple-DUP cleanup on Cloud-Rolling-Hills (~1,043 dup clips).
- Display ID prefix system (H-/S-/C-).
- Reconcile `products/` and `productLibrary/` (canonical row per houzzId).
- Clipper ID format revision (clean numeric # vs slug); Clipper writes to Library first, then routes.

### Design-board improvements identified Jun 13–14 (not yet built)
Raised by Cynthia during the design-board work; diagnosed, not implemented:
- **Search relevance ranking** — coverage is broad but ranking is weak (description matches under-weighted; ~100-item display cap can hide hits). Fix ranking before taxonomy.
- **Category taxonomy unification** — inconsistent/polluted categories vs the 21-category canon (see `CLEANUP_HISTORY.md` + houzz-taxonomy guard).
- **Missing/blurry board images** — hotlink-blocked or Magento-path sources; lean on Firebase Storage + `_resolveImgSrc`/preferred-image helpers.
- **Morpholio-style reports** — product report + cost report off the board (cost summary shipped; full product report is the next slice).
- **Highlight non-product board items** — flag items that must become products before they can go on a proposal.

---

## PART 4 — SHIPPED THIS SESSION (Jun 13–14)

Design-board + proposal usability arc. Files: `platform/cch-design-board.js`, `platform/index.html`. Deployed to **staging then production** Jun 14 (`cch-design-boards` → cch-platform.web.app).

- **Stability:** incremental DOM drag/render; "nuclear unstick"; hardened PNG export (re-entry guard, scale 1, confirm dialog); auto-close print windows (`onafterprint`); global Esc dismisses overlays. Addresses the freeze/hang reports.
- **Cost Summary (estimate):** priced product summary on the board with clear Internal/Client segmented toggle; print includes image thumbnails ("Images on print" toggle); nudge to convert images → products.
- **Print / Export menu:** replaced the broken `html2canvas` PNG export (tainted-canvas SecurityError) with Print board / Cost summary / Download PNG (hardened).
- **View clarity:** toggles now show current **state** (e.g. "👁 Client view: ON") instead of the action.
- **Board → Proposal:** auto-fills next **PRO#** as the document name; stores `proposalNum`, `createdBy`, increments `proposalCount`.
- **Room flow (the Jun 14 fix):**
  - New proposals **inherit the board's room** (`createProposalFromBoard`, `cch-design-board.js:2584`) — no more double-prompt.
  - Reusable room picker (`dbPickRoom`) — project-rooms dropdown + type-in.
  - **Bulk Actions → "Set room for all lines…"** on proposals (`setAllProposalLinesRoom`, `index.html`) for fixing existing proposals; verified by Cynthia (dropdown matched, room shows, grouped by room).

---

## Sources (grounded)
- `platform/index.html` — `renderPlatformStatus()` feature map (57594–57728); proposal Bulk Actions (~27274) + `setAllProposalLinesRoom`; proposal room render/group (`8746`, `12047`).
- `platform/cch-design-board.js` — `createProposalFromBoard` (2565+), `dbPickRoom` (2514+).
- `Docs/KNOWN_ISSUES.md`, `Docs/CURRENT_PRIORITIES.md`, `Docs/INTERNAL_CURRENT_PLATFORM_STATUS_CR_Jun09_v1.0.md`, `Docs/CLEANUP_HISTORY.md`.

---

## PART 6 — PO SHIP/PAY TWO-LANE MODEL (deploy backlog)

**Added:** Jun 25, 2026 · **Priority:** HIGH (financial correctness) · **Status:** 🔴 Open — model only, not built.

**Trigger:** PO-9017 analysis. The PO is `status: Paid` + `shippingStatus: Shipped` showing `$0 due`, yet **$4,991.35 of merchandise (4 lines) is still unshipped and unbilled**. The platform is collapsing two independent dimensions into one "balance."

### The core principle: ship and pay are separate lanes

| Dimension | Question it answers |
|---|---|
| **Ship (fulfillment)** | How much merchandise has shipped (ship invoices / lines) vs total PO lines? |
| **Pay (vendor money)** | How much has been paid vs what is **billed** (per invoice + combined)? |

They diverge routinely:
- Shipped but not paid → partial ship, $0 paid on that invoice.
- Paid deposit, not shipped → partial paid, nothing shipped.
- **PO-9017** → ship and pay match *on the 3 invoices that exist*, but $4,991.35 isn't shipped and **has no bill yet** — so it's **unbilled / not-yet-on-order-fulfillment**, NOT "unpaid balance."

### PO-9017 as the worked example

**Ship lane (fulfillment)**
- Shipped: **$6,551.02** (Riley, Farfalle, Stellar, Spur)
- Open to ship: **$4,991.35** (Barrett, Rousseau, Brock, Lorino)
- Correct ship status: **Partial shipped** (not "Shipped")

**Pay lane (vendor money)**
- Billed so far: **$6,551.02** (3 ship invoices)
- Paid on those bills: **$6,551.02** → **$0.00 bill balance** (those invoices are done)
- Not yet billed: **$4,991.35** (no invoice = nothing owed yet)
- PO-level: $6,551.02 paid of $11,542.37 total → partially paid relative to full PO, but **not** "vendor bill past due"

### What the UI should show (two numbers, never merged)

| Label | PO-9017 |
|---|---|
| **Open to ship** | $4,991.35 · 4 lines |
| **Bill balance due** | $0.00 (on received invoices) |
| **Paid to vendor** | $6,551.02 |
| **PO total** | $11,542.37 |
| **Ship status** | Partial shipped |
| **Pay status** | Bills paid · PO partially complete |

### Where the UI goes wrong today — CLAIMS TO GROUND BEFORE BUILDING

> Per the Code Grounding Protocol: the items below are the *reported* failure modes. Each must be grep'd + read against current code (multi-term, drift map) and confirmed before any change. Do **not** treat as established.

1. `status: Paid` — appears to treat the whole PO as paid because the *existing bills* are paid, ignoring the $4,991.35 unshipped. → grep the PO status setter(s).
2. `shippingStatus: Shipped` — appears to ignore the 4 open lines. → grep ship-status derivation.
3. One "balance" number — `bill.billTotal` ($3,512.92, stale) vs paid ($6,551.02) → shows `$0 due`. → grep balance/paid reducers (`cchPoListBalanceForRow`, `cchPoListPaidForRow`, `cchPoListDisplayTotal`).
4. Dropped from Open POs — `status === 'paid'` appears to close the PO even though fulfillment isn't done. → grep Open-POs / `cchOmNeedsBill` / OM filters.

### Target code model (for the implementer — #1)

- **Ship lane:** lines on `ship_invoice` groups vs all PO lines → derive partial / full shipped + `openToShip` $ and line count.
- **Pay lane:** `payments[]` vs **billed** total (per invoice + combined) → derive partial / full paid *on bills* and `billBalanceDue`.
- **Do not** set PO `Paid` when only the received bills are paid. Use a compound state, e.g. **"Bills paid · partial ship."**
- **Open POs filter:** keep open if `openToShip > 0` **OR** `billBalanceDue > 0` **OR** missing confirmation (etc.) — not solely on `status === 'paid'`.
- Surface both numbers on the PO page and the Open POs / Order Management view; never collapse into a single "balance."

### Acceptance check
- PO-9017 shows Open to ship $4,991.35 (4 lines), Bill balance due $0.00, Paid to vendor $6,551.02, PO total $11,542.37, Ship status "Partial shipped," Pay status "Bills paid · PO partially complete," and **remains in Open POs**.

---

## PART 7 — LEGACY PO BALANCES WRONG (shipping/tax) + Jun 26 bulk-close

🔴 **Open issue — REVISIT.** Logged Jun 26, 2026 (CR).

> **CORRECTION (Jun 26, same day):** The "Action taken" bulk-close below was applied to **Studio** POs by mistake. The directive was **only Houzz POs should be closed** — never Studio. All **175 Studio POs were reopened** and restored to their exact prior status (`_debug/reopen-studio-pos_BY_CR_2026-06-26.js`). Order Management verified back to 175 open. The Houzz cleanup (20 closed+locked, 5 dup deletes) was correct and remains. The shipping/tax balance problem described here is still open to fix.

### Symptom
Order Management → Open showed **175 non-Houzz POs** going back to **2017**, displayed as "Draft / Not sent" with "—" amounts. They looked like dead drafts.

### Grounded reality (read-only audit, Jun 26)
- Almost all 175 are **real POs**, not drafts. Example: **PO-10391** (katke-puerto-vallarta) is `status: "Partially Paid"`, total $509.52, paid $412, **QuickBooks-linked (`qbDocId` 46790)**, payment imported from Houzz.
- The OM "Draft / Not sent" columns are **display-only** (derived procurement lane + empty legacy `sentAt`) — they do **not** reflect the PO's real pay status.
- Aggregate at close time: total **$223,229.91**, recorded paid **$108,267.61**, apparent open balance **$114,962.30**.

### Cynthia's call (the actual truth)
**These POs are paid in real life.** The recorded "open balance" is a **data problem in how shipping and/or tax were added** to the PO total (totals inflated above what was actually billed/paid), not real money owed. Only a small set (**< 20, the Houzz POs**) is genuinely outstanding.

### Action taken Jun 26 (decluttering only — NOT a financial fix)
- **Closed all 175** open non-Houzz POs: `status: 'closed'` (+ `_closedReason`, `_closedAt`, `_statusBeforeClose`, `_bulkCloseV: '2026-06-26'`). **Left UNLOCKED** so they can be reopened/edited on revisit. **Did NOT mark Paid; did NOT invent payment amounts.**
- Backup: `cch-deploy/_debug/OLD_POS_CLOSE_BACKUP_BY_CR_2026-06-26.json` (full docs).
- Revisit list: `cch-deploy/_debug/CLOSED_OLD_POS_LIST_BY_CR_2026-06-26.csv` (number, project, vendor, status-before, year, total, paid, balance, qbDocId, docId).
- Scripts: `_debug/close-old-open-pos_BY_CR_2026-06-26.js`, `_debug/audit-open-pos_BY_CR_2026-06-25.js`.
- Verified after: OM → Open non-Houzz = **0**.

### The real fix to revisit (different problem, different day)
- **Root cause to ground:** how shipping and/or tax are added to PO line/merch totals, producing balances that exceed what was billed/paid. Grep PO total builders (`cchPoMerchandiseTotal`, `cchPoLineMerchandiseAmount`, `docEditRecalcTotals`, shipping/`docShipping`, tax) and the Houzz payment-import path (`_paymentImportedFromHouzzMay2`, `paymentImportedAt`).
- **Decide the truth source:** for QB-linked POs (`qbDocId`), reconcile paid/closed status against QuickBooks rather than the platform's recomputed total.
- **Then:** correct totals (or mark genuinely-paid) so closed status reflects real AP, and confirm the remaining truly-open set is only the < 20 Houzz POs.

### Acceptance check (future)
- Reopening any closed PO from the revisit CSV shows a total that matches its real billed/paid amount (shipping/tax no longer inflating it).
- OM → Open contains only genuinely-outstanding POs (the < 20 Houzz set), each with a correct balance.
