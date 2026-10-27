# CCH Studio — Current State, Overview & Rules

**File:** `CCH_STUDIO_CURRENT_STATE_CR_Aug12_v1.0.md`  
**Author:** Cursor (CR) · grounded in live code Aug 12, 2026  
**Audience:** New design assistants, Vanessa, Claude Team skills, anyone onboarding to the platform  
**Status:** CANON — feature names from **UI labels**; structure from code + `firestore.rules`

**Companion (locked facts only):** `CCH_PLATFORM_RULES_AND_DESIGN_INTENT_CR_Aug12_v1.0.md`  
**Claude Team copy (no repo paths):** `Dropbox/Claude - CCH studio/Studio Claude skills/CCH_STUDIO_PLATFORM_OVERVIEW_C-Team_Aug12_v1.0.md`

---

## 1. What CCH Studio is

CCH Design Studio is Cindy Holloway’s **luxury residential interior design** practice platform — a custom web app for running projects from first inspiration through selections, client proposals, invoicing, purchasing, receiving, and QuickBooks sync. Staff work in **Studio** (`cch-platform.web.app`). Clients use a lightweight **Client Portal** (`client.html`). The product is intentionally **one firm, one library, snapshot financial documents** — not multi-tenant SaaS.

**Design flow in one sentence:** Inspire → select products into a project → room/design boards → proposal → client approves (often line-by-line) → invoice → client pays → POs & vendor bills → deliver & reconcile.

---

## 2. Architecture

| Layer | Detail |
|-------|--------|
| **Studio app** | `platform/index.html` (~85k lines) + ~27 `platform/cch-*.js` modules |
| **Client portal** | `platform/client.html` (~730k chars) — clients never load full Studio |
| **Custom Order Builder** | `platform/builder/index.html` — upholstery/custom work orders |
| **Hosting** | Firebase Hosting · production `cch-platform.web.app` · staging `cch-platform-staging.web.app` |
| **Database** | Firestore · production project `cch-design-boards` · staging `cch-studio-staging` (**separate data**) |
| **Functions** | `Functions/index.js` — QuickBooks, Timely sync, Airtable PO push, weekly report, etc. |
| **Chrome Clipper** | Separate extension repo — captures products into library/clips |
| **Theme** | Navy sidebar `#0F1A2E`, gold `#C4A464`, white content — one theme |

### Live integrations

| Integration | Status | Module / notes |
|-------------|--------|----------------|
| **QuickBooks Online** | Live, **bidirectional** | Push invoices/bills; pull paid/balance (`cch-qb-dashboard.js`, `QUICKBOOKS-BALANCE-SYNC.md`) |
| **Timely** | Live, **production only** | Smart Time → Timely Logged tab; sync via Cloud Function |
| **Airtable** | Live | PO push to receiving base (`cch-airtable-push.js`) |
| **ElevenLabs** | Live | Voice profile (`cch-voice-profile.js`) |
| **Twilio SMS** | **Backlog / stub** | Listed in release backlog; not a live two-way integration |
| **Desktop time agent** | Live | Import Desktop Log → Smart Time captures |

---

## 3. Three board features (do not merge)

These are **three different product features**. Old docs that flatten them are wrong.

| UI name (staff project tab) | UI name (client portal) | What it is | Data |
|------------------------------|-------------------------|------------|------|
| **Inspiration** | **Inspiration Boards** | Mood / reference boards; client stars & comments | `boards/{id}/ideabooks` — images + inline `feedback` on items |
| **Room Boards** | **Room Boards** | Products **selected for the project**, grouped by room | **`clips`** grouped by `room` + **`roomMeta`** — no `roomBoards` collection |
| **Design Boards** | **Design Boards** (staff); client sees published views | Canva-style visual boards for what goes in a room | `boards/{id}/designBoards` |

**Style Library** (firm sidebar) = internal `_lib_designer` pseudo-project — reference ideabooks only, copy into real projects.

**Selections** tab = editable product grid/list (same underlying **clips**, different UI from Room Boards).

---

## 4. Feature glossary

**Columns:** UI name · Where · Module(s) · Firestore / data · Purpose · Client sees?

### 4.1 Firm-wide sidebar (Studio)

| UI name | Where | Module(s) | Data | Purpose | Client? |
|---------|-------|-----------|------|---------|---------|
| **Search** | Sidebar ⌘K | `index.html` | — | Global search | — |
| **Dashboard** | Sidebar | `index.html` | `boards`, aggregates | Owner/contractor KPIs, alerts | No |
| **Follow-Ups** | Sidebar | `cch-followups.js` | project tasks / follow-up views | Track open follow-ups firm-wide | No |
| **Inspiration** | Sidebar | `index.html` | `ideabooks` (legacy top-level + per-project) | Firm-wide inspiration hub list | No |
| **Style Library** | Sidebar (admin) | `index.html` | `_lib_designer` / ideabooks | Internal reference boards | No |
| **Pinterest** | Sidebar drawer | `index.html` | — | Live Pinterest panel | No |
| **Projects** | Sidebar | `index.html` | `boards` | All projects grid/list | No |
| **Tasks** | Sidebar | `index.html` | `boards/.../tasks`, top-level `tasks` | All tasks across projects | Partial (`clientVisible` tasks only in portal) |
| **Product Library** | Sidebar | `index.html` | **`productLibrary`** (canonical), legacy `products` | Firm master catalog | No |
| **Proposals** | Sidebar | `cch-proposals-invoices-fix.js` | `boards/.../proposals` | Firm-wide proposal list | Partial (published proposals in portal) |
| **Invoices** | Sidebar | same | `boards/.../invoices` | Firm-wide invoice list | Partial (published invoices in portal) |
| **Purchase Orders** | Sidebar | `cch-po-bill-variance.js` | `boards/.../purchaseOrders` | Firm-wide PO list | **No** |
| **FFE Schedule** | Sidebar | `cch-ffe-procurement.js` | clips / FFE fields | Furnishings schedule all projects | No |
| **Order Management** | Sidebar (admin) | `cch-order-management.js` | POs, bills, variances | PO ops hub — track, pay, variances | No |
| **Vendor Bills** | Sidebar | `cch-po-bill-variance.js` | PO vendor bill fields | Firm-wide vendor bill inbox | No |
| **Bill variances** | Sidebar sub | same | variance tags on bills | Freight/tax over PO → client invoice | No |
| **Clients** | Sidebar | `index.html` | `clients` + board client fields | Client list | No |
| **Vendors** | Sidebar | `index.html` | `vendors` | Vendor directory + detail | No |
| **Showrooms** | Sidebar | `index.html` | `vendors` (filtered) | Showroom contacts | No |
| **Subcontractors** | Sidebar | `index.html` | `vendors` / team | External subs (money-free views) | No |
| **Workrooms** | Sidebar | `index.html` | `workrooms` | Workroom contacts | No |
| **Receivers** | Sidebar | `index.html` | vendor-type contacts | Delivery receivers | No |
| **Order Builder** | Tools | `platform/builder/index.html` | `boards/.../workOrders` | Custom upholstery / furniture specs | No |
| **Receiving** | Tools | `cch-order-management.js` / OM | deliveries | Incoming shipment tracking | No |
| **E-Specs** | Tools | `index.html` specbook + tear sheets | project spec lines | Spec book / tear sheet engine | No |
| **Smart Time** | Time & Reports | `index.html` | `desktopTimeLogs`, captures | Day timeline, memories, log time | No |
| **Reconciliation** | Smart Time tab | `index.html` | `timelyEntries`, `timeEntries` | Match Timely → ledger | No |
| **Time Ledger** | Smart Time tab | `index.html` | **`timeEntries`** (top-level) | Billable logged time | No |
| **Timely Logged** | Smart Time tab | `index.html` + Functions | **`timelyEntries`** (top-level) | Pull from Timely API; pending → log | No |
| **Activity Feed** | Sidebar | `index.html` | **`activity`** (top-level) | Firm activity timeline | Partial (client actions appear) |
| **Schedule** | Sidebar | `index.html` | milestones on boards | Global schedule view | No |
| **Financials** | Sidebar | `index.html` | invoices, POs, time | Firm financial reports | No |
| **QuickBooks** | Sidebar (admin) | `cch-qb-dashboard.js` | `settings/integrations` | Connect, map, sync QB | No |
| **Profit Tracker** | Sidebar sub | `index.html` | computed from project data | Margin / profit view | No |
| **Settings** | Sidebar | `index.html` | `settings`, `team` | Rates, integrations, admin tools | No |
| **Release Notes** | Sidebar | `index.html` | — | What's New | No |
| **Platform Status** | Sidebar (admin) | `index.html` `renderPlatformStatus` | — | Internal feature map (may lag code) | No |
| **Bugs & Requests** | Sidebar | `cch-bugs-requests.js` | **`feedbackRequests`** | Internal bug/feature board | No |
| **Staff chat** | Sidebar | `cch-staff-chat.js` | `internal/staffChat/messages` | Cindy ↔ Vanessa thread | No |
| **Pepper** (staff) | Floating / project | `cch-pepper.js` | Claude via Functions | Staff AI assistant | No |

### 4.2 Inside a project (Studio tabs)

| UI name | Module(s) | Data | Purpose | Client? |
|---------|-----------|------|---------|---------|
| **Overview** | `index.html` | board doc, financial bar | Project summary, health | No |
| **Work Orders** | `index.html` + builder | `workOrders` | Custom orders (opens Order Builder) | No |
| **Tasks** | `index.html` | `tasks` | Project tasks; **`clientVisible`** flag | Partial |
| **Selections** | `index.html` | `clips` | Editable product list/grid | No |
| **Inspiration** | `index.html` | `ideabooks` | Project mood boards | Partial (portal) |
| **Room Boards** | `index.html` | `clips` + `roomMeta` | Room-grouped selections | Partial (portal) |
| **Design Boards** | `cch-design-board.js` | `designBoards` | Visual layout boards | Partial (published) |
| **FFE Tracker** | `cch-ffe-procurement.js` | clips FFE fields | Status schedule per item | No |
| **Spec Book** | `index.html` | spec lines / tear sheets | Spec sheets, E-Specs source | No |
| **Proposals** | `cch-proposals-invoices-fix.js` | `proposals` | Create/edit PRO-3000+ docs | Partial |
| **Invoices** | same + `cch-invoice-redesign.js` | `invoices` | INV-6000+ billing | Partial |
| **Purchase Orders** | `cch-po-bill-variance.js` | `purchaseOrders` | PO-9000+ vendor orders | **No** |
| **Bill variances** | `cch-po-bill-variance.js` | on PO/bill | Project discrepancy tab | No |
| **Financials** | `index.html` | project aggregates | Admin project money view | No |
| **Files & Docs** | `index.html` | `files`, `clientDocuments` | Uploads + client-shared docs | Partial (`clientDocuments`) |
| **Time** | `index.html` | `timeEntries` filtered | Project time embed | No |
| **Communications** | `index.html` | `messages`, `correspondence`, comms feed | Unified comms | Partial (messages) |
| **Notes** | `index.html` | `notes`, `projectNotes` | Internal + shared notes | Partial (shared notes) |
| **Follow-Ups** | `cch-followups.js` | tasks | Project follow-up view | No |

### 4.3 Client Portal (`client.html`)

URL pattern: **`client.html#/clientview/{projectId}`** (project ID, not slug). No login — capability URL + optional client session.

| UI name | Purpose | Client? |
|---------|---------|---------|
| **Home** | Project landing | Yes |
| **Messages** | Thread with studio | Yes |
| **Notes** | Shared notes | Yes |
| **Updates** | Progress updates (`progressUpdates`) | Yes |
| **Decisions** | Approve/decline items (`clientDecisions`) | Yes |
| **Inspiration Boards** | Star, comment, note on ideabook images | Yes |
| **Room Boards** | View room-grouped selections | Yes |
| **Proposals** | View / approve lines (partial approval) | Yes |
| **Invoices** | View; may show hours/rates if toggled on invoice | Yes |
| **Documents** | `clientDocuments` — review/approve files | Yes |
| **Tasks** | Client-visible tasks only | Yes |
| **Activity** | Client-side activity feed | Yes |
| **Time & Progress** | High-level progress (not internal ledger) | Yes |
| **Client Pepper** | `cch-client-pepper.js` — AI in portal header | Yes |
| **Purchase Orders, costs, markup, library** | — | **Never** |

### 4.4 Document & print features

| Feature | Where | Purpose |
|---------|-------|---------|
| **Tear sheets / E-Specs** | `index.html` (`generateTearSheetsFromDoc`, etc.) | Printable spec sheets from proposal/invoice/PO |
| **Client View invoice** | `cch-invoice-redesign.js` | Client-facing invoice layout in Studio + portal |
| **Proposal Client View** | `cch-proposals-invoices-fix.js` | Client-facing proposal presentation |
| **Print / PDF** | Invoice & proposal landing toggles | Print-friendly views |

---

## 5. Data model

### 5.1 Project = `boards/{projectId}`

The project document lives in top-level **`boards`**. Most project data is in **subcollections**:

`clips`, `ideabooks`, `designBoards`, `proposals`, `invoices`, `purchaseOrders`, `tasks`, `files`, `clientDocuments`, `clientDecisions`, `messages`, `notes`, `roomMeta`, `workOrders`, `progressUpdates`, `whatsNew`, `correspondence`, `clientSessions`, `heroImages`, `notifications`, `clipSuppressions`, `projectNotes`

**Auth note (from `firestore.rules`):** `purchaseOrders`, `designBoards`, `workOrders` = **staff auth only**. `proposals`, `invoices`, `ideabooks`, `clips`, `tasks`, `clientDocuments`, `clientDecisions` = **portal-readable** (with update guards for client actions).

### 5.2 Top-level collections (firm-wide)

| Collection | Holds |
|------------|--------|
| `boards` | Projects |
| **`productLibrary`** | Canonical master catalog (**prefer over `products`**) |
| `products` | Legacy / Houzz import catalog |
| `productLibrary_archive` / `products_archive` | Quarantined junk rows |
| `clients`, `vendors`, `workrooms`, `team` | Contacts & team |
| **`timeEntries`** | Logged billable time (ledger) |
| **`timelyEntries`** | Timely API pull + webhook staging |
| `desktopTimeLogs` | Desktop agent batches |
| **`activity`** | Activity feed events |
| `feedbackRequests` | Bugs & Requests board |
| `settings` | docCounters, Timely token, integrations, rates |
| `reports`, `briefings`, `deliveries`, `notes`, `tasks` | Various firm tools |
| `internal/staffChat/messages` | Staff chat |

**Not top-level per project:** `activity`, `timeEntries`, `timelyEntries` — common mistake in old skills.

### 5.3 Houzz vs Studio-native

Records with `source: 'houzz-import'`, **`IN-*`** invoice labels, or import batch tags are **legacy** — do not treat as live Studio numbering or behavior.

---

## 6. Business rules (operating logic)

See **`CCH_PLATFORM_RULES_AND_DESIGN_INTENT`** for the full locked list. Summary:

| Topic | Rule |
|-------|------|
| **Doc numbers** | PRO-3000+, INV-6000+, PO-9000+ (`index.html:4484`) |
| **Line items** | **Copied snapshot** at add time — library edits do **not** propagate (`cch-doc-isolation.js`) |
| **Partial approval** | Client approves subset → convert to invoice → `Partially Invoiced` (`cch-proposals-invoices-fix.js:1171`) |
| **One proposal → many invoices** | Normal |
| **PO timing** | After **invoice payment**, not proposal approval |
| **PO line lock** | On **send** (`cchPoIsLocked`) |
| **Invoice cost lock** | Trade cost locks when invoice **sent/paid/overdue** or QB-synced (`cch-cost-lock.js:55-58`) — distinct from “can edit description” |
| **QuickBooks** | Push **and** pull paid/balance |
| **Timely** | **Production Studio only** — staging has no Timely sync |
| **AI / QB push** | Draft-then-human; Cindy GO for production deploy |

---

## 7. Client visibility (standing rule)

**Clients see THEIRS, not OURS.**

| Never client-facing | May be client-facing |
|---------------------|----------------------|
| POs, vendor bills, variances | Published proposals & invoices |
| Cost, markup, margin, DNET | Inspiration (stars/comments) |
| Product Library | Room Boards (selections view) |
| Smart Time / ledger / reconciliation | Decisions, Documents, Tasks (`clientVisible`) |
| QuickBooks, Order Management | Messages, Updates, Activity |
| Internal notes, Staff chat, Bugs board | Invoice hours/rates (**optional toggle**, default off) |

---

## 8. Design process phases (how Cindy runs a project)

1. **Discovery** — Inspiration, Style Library, Pinterest  
2. **Selections** — Clipper / library → clips → Room Boards  
3. **Design** — Design Boards, FFE, Spec Book / tear sheets  
4. **Sell** — Proposal → client line approval (partial OK) → invoice  
5. **Collect** — Payment tracking, QB sync  
6. **Buy** — PO after paid → Order Management → vendor bill → variance if needed  
7. **Deliver** — Receiving, Airtable push, client Updates / Progress  

---

## 9. Module quick reference

| File | Owns |
|------|------|
| `cch-proposals-invoices-fix.js` | Proposals, invoices, convert, much doc edit |
| `cch-invoice-redesign.js` | Invoice Client View |
| `cch-invoice-tax-rules.js` | CA tax |
| `cch-po-bill-variance.js` | PO, vendor bills, variance (largest module) |
| `cch-po-vendor-comms.js` | PO vendor email threads |
| `cch-order-management.js` | Order Management hub |
| `cch-ffe-procurement.js` | FFE |
| `cch-design-board.js` | Design Boards canvas |
| `cch-doc-isolation.js` | No back-sync guards |
| `cch-cost-lock.js` | Cost lock rules |
| `cch-qb-dashboard.js` | QuickBooks UI + balance sync |
| `cch-pepper.js` / `cch-client-pepper.js` | Staff / client AI |
| `cch-followups.js` | Follow-Ups |
| `cch-staff-chat.js` | Staff chat |
| `cch-bugs-requests.js` | Bugs board |
| `cch-progress-updates.js` | Client progress / bi-weekly updates |
| `cch-client-activity.js` / `cch-client-board.js` / `cch-client-ideas.js` | Portal helpers |
| `cch-airtable-push.js` | Airtable PO push |
| `cch-voice-profile.js` | ElevenLabs voice |
| `cch-product-categories.js` | 21 canonical FFE categories |
| `platform/builder/index.html` | Custom Order Builder |

---

## 10. Unknowns / confirm with Cindy

| Item | Question |
|------|----------|
| **Order Management nav** | Hidden until flag/admin — who sees it day-to-day? |
| **Contractor portal** | External subs “money-free” — full spec still open? |
| **Invoice line edit vs lock** | Which fields stay editable after Sent/Paid? (cost lock ≠ all fields) |
| **AI Hours Correction factor** | Referenced in CFO skill — not found in Smart Time code; drop or implement? |
| **Platform Status page** | Still shows PO-400000+ in places — UI cleanup queued? |
| **Legacy top-level `ideabooks`** | Still read by old client paths — deprecation plan? |

---

## Revision history

- **v1.0 (Aug 12, 2026, CR):** Initial full overview per `WO-STUDIO-STATE-DOC_C-Team_Aug12_v1.0_2.md`. UI names from sidebar (`index.html:3406+`) and project tabs (`17006`). Client portal from `client.html:9101+`. Collections from `firestore.rules:184+`.
