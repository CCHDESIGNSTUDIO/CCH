# CCH Studio — Platform Rules & Design Intention

**File:** `CCH_PLATFORM_RULES_AND_DESIGN_INTENT_CR_Aug12_v1.0.md`  
**Author:** Cursor (CR) · synthesized from live code + Aug 12 skill audit  
**Status:** **CANON** — all agents, skills, and handoffs defer to this doc when facts about “what the platform does” conflict with older notes.

**Companion (full overview):** `CCH_STUDIO_CURRENT_STATE_CR_Aug12_v1.0.md`  
**Claude Team copy (no repo paths):** `Dropbox/.../Studio Claude skills/CCH_STUDIO_PLATFORM_OVERVIEW_C-Team_Aug12_v1.0.md`

**Does not replace:** deploy policy (`.cursor/rules/commit-deploy-policy.mdc`), Houzz taxonomy (`Docs/CLEANUP_HISTORY.md`), grounding protocol (`Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md`), isolation guard implementation (`platform/cch-doc-isolation.js`).

---

## 1. Design intention (why the platform is built this way)

CCH Design Studio is Cindy Holloway’s **luxury residential interior design** operating system — not enterprise SaaS, not yacht/commercial (residential + ELU fireplace line only).

| Principle | Meaning in practice |
|-----------|---------------------|
| **Snapshots, not live links** | Proposals, invoices, and POs are **frozen copies** of selections at document time. Library and clip edits must not silently rewrite financial docs. |
| **Clients see THEIRS, not OURS** | Client portal shows their proposals, invoices, inspiration, decisions — never internal cost, markup, POs, or firm ledger. |
| **Ordering follows money** | Client approves → subset may invoice → client pays → **then** procurement/PO workflow. Payment gates ordering, not approval alone. |
| **One firm, one library** | `productLibrary/` is the firm catalog; project `clips` are project selections. Dedup/match refs exist; they are not live bindings. |
| **Staging is a sandbox** | Separate Firebase project (`cch-studio-staging`). No production data. **Timely sync is production-only.** |
| **Single-file shell** | `platform/index.html` is the app shell (~85k lines) + `platform/cch-*.js` modules. Intentionally not split. |
| **Ground before claim** | Agents grep + read + cite `file:line` before stating behavior or editing. Skills are not evidence of current code. |

**Visual identity:** Dark navy sidebar, white content, gold accents — **one theme**. Navy `#0F1A2E`, gold `#C4A464`, cream/white `#FFFFFF`. No pure black UI. No rainbow status colors (removed v6.7.0).

**UX doctrine:** Styled modals (`cchDialog` / `cchConfirm`), not raw `prompt`/`alert`/`confirm`. Client portal CSS uses `.cp-` prefix. DM Sans + Cormorant/Playfair for display.

---

## 2. Locked platform facts (agents must not contradict these)

These are verified against live code Aug 12, 2026. If a skill, memo, or agent says otherwise, **this section wins** until Cindy updates it with a new grounded revision.

### 2.1 Document numbering

| Series | Start | Evidence |
|--------|-------|----------|
| Proposals | **PRO-3000+** | `index.html:4484` `_docNumberStartOffsets.PRO = 2999` |
| Invoices | **INV-6000+** | `index.html:4484` `INV = 5999` |
| Purchase orders | **PO-9000+** | `index.html:4484` `PO = 8999` |

- **`IN-10000` / `IN-129xx`** — Houzz **legacy import** labels, not the Studio auto-number series.
- **`DOC-1001+`** — optional **client file** numbering (`clientDocuments` subcollection), **not** a financial doc series. Do not list alongside PRO/INV/PO.

There is **no DOC-#### financial series**.

### 2.2 Copy vs link (document isolation)

- Line items on proposals/invoices/POs are **shallow copies** at add time (`Object.assign`, spread copies) — **not live pointers** to Product Library or clips.
- `libraryProductId` / `roomClipId` on lines are for **dedup, matching, and explicit Apply from Library** — not automatic propagation.
- **Library edits do NOT update existing financial documents.**
- Line fields (title, description, price, qty) **are editable on the document** and stay local to that doc.
- **Guard:** `platform/cch-doc-isolation.js` — no back-sync on save. Explicit UI only: Apply from Library, Link to Room Boards.

### 2.3 Proposal → invoice → PO workflow

| Step | Rule |
|------|------|
| Partial approval | Client may approve a **subset** of proposal lines. That subset converts to an invoice; remainder stays open. **One proposal → many invoices.** Evidence: `cch-proposals-invoices-fix.js:1171` `Partially Invoiced`. |
| Convert timing | Subset convert does **not** require full proposal approval. |
| PO creation | POs are created **after invoice payment** (payment triggers ordering), **not** on proposal approval alone. |
| PO line lock | PO lines lock on **send**, not on payment (`cch-po-bill-variance.js` — PO immutable after sent; variance captured on vendor bill). |

### 2.4 QuickBooks

- Sync is **bidirectional**: Studio **pushes** invoices/bills **and pulls** paid/balance status back.
- Functions: `syncInvoiceBalanceFromQB`, `batchSyncInvoiceBalancesFromQB` (`cch-qb-dashboard.js`; `Functions/index.js`).
- Deploy doc: `QUICKBOOKS-BALANCE-SYNC.md`.
- **Wrong:** “QB is push-only” or “never pull from QB.”

### 2.5 Client visibility

| Clients **may** see | Clients **never** see |
|---------------------|------------------------|
| Their proposals (client view) | Purchase orders (entirely internal) |
| Their invoices (including **optional** hours/rates toggle on time invoices) | Cost, markup, margin, DNET |
| Inspiration / ideabooks (stars, comments inline on items) | Smart Time ledger, internal time reconciliation |
| Client decisions, comms, design boards (as configured) | Product Library firm catalog |
| Client portal home, documents shared to them | Vendor bills, PO variance internals |

- **Time on invoices:** display toggle exists (`cch-inv-disp-hours` / `cch-inv-disp-rate` in `cch-proposals-invoices-fix.js`) — default off; capability ships.
- **Internal ledger:** Smart Time / Time Ledger / Timely reconciliation — staff only.
- **Portal:** `client.html#/clientview/{projectId}` (lightweight portal; full Studio redirects here for client routes). Project **ID**, not slug.
- **Firestore:** `purchaseOrders` read requires auth (`firestore.rules`) — not client-facing.

### 2.6 Environments

| | Staging | Production |
|---|---------|------------|
| Firebase project | `cch-studio-staging` | `cch-design-boards` |
| URL | `cch-platform-staging.web.app` | `cch-platform.web.app` |
| Data | Isolated test data | Live firm data |
| Timely sync | **Disabled** — prod only (`cchTimelyEnabledHere()`) | Connect + Sync from Timely |
| Deploy | Default; no Cindy GO required for hosting | Hosting/functions only on Cindy typed **GO** |

---

## 3. Firestore & module map (use these names)

### 3.1 Top-level collections (common)

`boards`, `productLibrary`, `products` (legacy/Houzz), `clients`, `vendors`, `team`, `settings`, `timelyEntries`, `timeEntries`, `activity`, `members`, …

### 3.2 Per-project under `boards/{projectId}/`

| Real name | Wrong / stale name in old skills |
|-----------|----------------------------------|
| `clips` | — (selections source) |
| `proposals`, `invoices`, `purchaseOrders` | — |
| `ideabooks` | ~~inspirationBoards~~ |
| `designBoards` (+ open in design-board module) | ~~roomBoards~~ as subcollection |
| `workOrders` | Custom Order Builder saves here |
| `tasks`, `files`, `milestones`, `updates`, … | ~~activity~~ as subcollection (activity is **top-level**) |

**Room boards** in UI = grouped view over **clips** + room metadata — not a separate `roomBoards/` subcollection.

**Inspiration feedback** = inline on ideabook item rows — not `images/{id}/feedback/{id}` subcollections.

### 3.3 Major modules (`platform/cch-*.js`)

| Module | Role |
|--------|------|
| `cch-proposals-invoices-fix.js` | Proposals, invoices, convert, QB hooks |
| `cch-invoice-redesign.js` | Client View invoice layout |
| `cch-invoice-tax-rules.js` | CA tax rules |
| `cch-po-bill-variance.js` | PO send lock, vendor bills, variance |
| `cch-order-management.js` | Firm Order Management hub |
| `cch-ffe-procurement.js` | FFE tracker / procurement |
| `cch-design-board.js` | Design Boards canvas |
| `cch-doc-isolation.js` | Snapshot / no back-sync guards |
| `cch-cost-lock.js` | Cost lock on sent docs |
| `cch-qb-dashboard.js` | QuickBooks UI + balance sync |
| `cch-client-pepper.js`, `cch-pepper.js` | Client + staff AI assistants |
| `cch-followups.js`, `cch-staff-chat.js`, `cch-bugs-requests.js` | Ops comms |
| `cch-progress-updates.js` | Bi-weekly client updates |
| `cch-airtable-push.js` | PO → Airtable receiving |
| `builder/index.html` | **Custom Order Builder** (separate hosted app) |

---

## 4. Agent operating rules (all sessions)

1. **Work from** `C:\dev\CCH-Platform-Deploy\cch-deploy` — not Dropbox code copy.
2. **Do not commit/deploy** unless repo owner #1 or Cindy asks — queue `_DEPLOY_QUEUE.md`.
3. **Ground every factual claim** this turn (`grep` ≥3 aliases, read body, cite `file:line`).
4. **Respect document isolation** — never add silent library/clip writes from doc save paths.
5. **Staging first** for UI changes; production only on Cindy **GO**.
6. **Never paste secrets** in chat — use local `*.env` + `firebase functions:secrets:set`.
7. **Agent spreadsheets:** `*_BY_CLAUDE_*` — never overwrite Cindy’s working XLSX.
8. **Skills & memos** are leads — verify against this doc + live code before acting.

---

## 5. What to fix in Claude Team skills (checklist)

When rewriting skills in `Dropbox\Claude - CCH studio\Studio Claude skills`, align every factual claim to **§2** and **§3**. Priority fixes from Aug 12 audit:

- [ ] Remove “products linked globally / library edits propagate”
- [ ] QB bidirectional (not push-only)
- [ ] INV-6000+ (not IN-10000+ as Studio series)
- [ ] Partial approval + one proposal → many invoices
- [ ] PO after payment; PO lock on send
- [ ] Firestore collection name corrections
- [ ] Add missing subsystems: Order Management, Custom Builder, PO variance, Pepper, Follow-ups, Staff Chat, Bugs board
- [ ] Refresh UX tokens: navy `#0F1A2E`, gold `#C4A464`
- [ ] Remove fabrications: yachts practice, Twilio-as-live, DOC as financial series

**Source audit:** `C-Team_Aug12_v1.0` (save a copy in `Docs/` when convenient).

---

## 6. Related canon (pointers)

| Topic | Doc / file |
|-------|------------|
| Deploy / queue | `_DEPLOY_QUEUE.md`, `.cursor/rules/commit-deploy-policy.mdc` |
| Staging vs prod | `.cursor/rules/cch-staging-production.mdc` |
| Isolation implementation | `platform/cch-doc-isolation.js`, `.cursor/rules/document-isolation.mdc` |
| Houzz import | `Docs/CLEANUP_HISTORY.md` |
| Grounding | `Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md` |
| QB balance pull | `QUICKBOOKS-BALANCE-SYNC.md` |
| In-app feature map | `index.html` → `renderPlatformStatus()` (admin UI; may lag — verify numbers against §2.1) |

---

## Revision history

- **v1.0 (Aug 12, 2026, CR):** Initial canon — one rules + design intention doc after Claude Team skill audit. Grounded: doc offsets, isolation, QB, client boundary, Firestore names, staging/Timely policy.
