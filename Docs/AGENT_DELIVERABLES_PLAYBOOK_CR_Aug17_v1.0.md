# CCH Studio — Agent Deliverables Playbook

**File:** `AGENT_DELIVERABLES_PLAYBOOK_CR_Aug17_v1.0.md`  
**Author:** Cursor (CR) · **Date:** Aug 17, 2026  
**Audience:** Cindy, Vanessa, Claude Team, Cursor agents, Cowork  
**Status:** CANON for the **agent lane** — complements `CCH_STUDIO_CURRENT_STATE_CR_Aug12_v1.0.md` (Studio lane)

**Claude Team upload:** `Dropbox/Claude - CCH studio/Studio Claude skills/AGENT_DELIVERABLES_PLAYBOOK_C-Team_Aug17_v1.0.md`

---

## 1. Two lanes — stop merging them

| Lane | Where it lives | What it is |
|------|----------------|------------|
| **Studio lane** | `cch-platform.web.app` + Firestore | Live data: proposals, clips, POs, QB, client portal, approvals |
| **Agent lane** | Claude, Cursor, Cowork, Fable | **Production shop** for documents, spreadsheets, reports, takeoffs, presentations |

**Rule:** If the output is a **file Cindy reviews once and sends** (PDF, HTML book, XLSX, deck), it belongs in the **agent lane**. If the output must **stay in sync with payments, inventory, or client actions**, it belongs in **Studio**.

Houzz Pro tries to do both in one app (AI takeoffs, 3D, receipts). CCH wins by being **deep on Studio** and **fast on agents** — not by cloning their GC toolbox.

---

## 2. What agents produce (yes) vs what Studio owns (no)

### Agents produce

| Category | Examples |
|----------|----------|
| **Editorial deliverables** | Room Book, Selections/Category Book, Tile Packet |
| **Spec & install packages** | E-Spec book PDF, tear-sheet batches, installer packets |
| **Takeoffs & schedules** | Tile/sf counts from plans, FF&E schedule exports, open-items sheets |
| **Financial / ops reports** | PO–QB reconciliation, Bugle Trail variance, Houzz audit spreadsheets |
| **Client comms drafts** | Bi-weekly update prose polish, cover letters, email to architect |
| **Marketing / brand** | Trade one-pager, postcard, brand copy deck |
| **Research & audits** | Open-items board, skill audit, platform status, competitor gap analysis |
| **Data cleanup manifests** | Dry-run JSON/CSV for Firestore scripts (agent writes manifest; **Cindy GO** for apply) |

### Studio owns (agents do not replace)

| Category | Why |
|----------|-----|
| Proposals, invoices, POs, payments | Financial system of record + QB |
| Client portal live views | Approvals, decisions, inspiration stars |
| Product Library + clips | Master catalog; isolation rules |
| Order Builder work orders | Custom upholstery specs tied to Firestore |
| Smart Time / Timely / ledger | Billable hours |
| QuickBooks push/pull | Live sync |
| Chrome Clipper capture | Real-time product ingest |

### Explicitly NOT in Studio (agent-only if needed)

- AI floor-plan takeoffs (upload plan → agent spreadsheet/PDF)
- 3D from scans / 2D→3D models
- Construction daily logs + voice-to-task in the field
- Receipt OCR → expense entry
- GC-style estimate-from-voice → full job budget

---

## 3. Three locked deliverable formats (never invent a fourth)

**Source:** `Dropbox/Claude - CCH studio/cch-deliverable-formats.md` (Cindy lock, May 26, 2026)

| Format | Axis | Audience | Length | Notes |
|--------|------|----------|--------|-------|
| **A. Room Book** | One **room**, all categories | Architect / project team | 16+ pages | Hero = room rendering; Hermes Master Suite = reference |
| **B. Selections / Category Book** | One **category**, all rooms | Client walkthrough | 10–15 pages | Palette plate, room sections, open items, schedule ref |
| **C. Tile Packet** | Tile scope + drawings | Installer on-site | Dense | Sheet IDs: **K-** key, **S-** schedule, **R-** room, **V-** vendor, **O-** open |

**Not the same as:** Room Board collage / Niice mood board. Room Books use the **CCH editorial chassis** (`cch-editorial-template` in Claude memory).

When Cindy says “room book” or “selections book,” pick A or B. When she says “tile packet,” pick C.

---

## 4. Deliverable catalog

| ID | Deliverable | Primary agent | Inputs (from Cindy / Studio) | Output | Publish path |
|----|-------------|---------------|--------------------------------|--------|--------------|
| **D1** | Room Book | Claude (layout) + Cursor (HTML/PDF) | Project name, room, renderings, clip/proposal export or screenshots, category list | HTML → PDF, 16+ pp | Email / Documents tab / architect |
| **D2** | Category / Selections Book | Claude | Category name, selections by room, palette images | HTML → PDF | Client meeting / portal Documents |
| **D3** | Tile Packet | Claude + Cursor | Plans (PDF/image), tile schedule, vendor refs, elevations | PDF bundle, K/S/R/V/O sheets | Installer + job folder |
| **D4** | Tear sheet batch | Studio print **or** agent HTML | Proposal/invoice/selections doc ID; product lines | PDF per product | Client / vendor RFQ (WO-046) |
| **D5** | E-Spec book | Studio (staging wizard) + agent for gaps | Invoice or FFE source; `specUrl` on products | Live book + PDF (Reece-style) | Portal share link + Files |
| **D6** | Takeoff spreadsheet | Claude / Cursor | Floor plan PDF, scope note, unit prefs | `*_BY_CLAUDE_*.xlsx` | Internal; attach to Tile Packet |
| **D7** | Bi-weekly update draft | Studio WO-047 + Claude voice | Live project: boards, decisions, tasks | Portal Updates (published) | **Client iPad** (WO-114) |
| **D8** | Open-items / status board | Cursor | Ledger, deploy queue, project docs | HTML + markdown audit | Internal / Claude Team |
| **D9** | PO–QB / Houzz recon | Cursor (dry-run scripts) | Outgoing PO xlsx, Firestore export | Audit XLSX + manifest JSON | Internal; Cindy GO to apply |
| **D10** | Invoice narrative | Studio AI (`draftInvoiceSummary`) + voice profile | Invoice doc, time entries | Client View text | Portal invoice |
| **D11** | RFQ to vendor | Studio (WO-046 when built) | Selected lines by vendor | PDF + email | Vendor |
| **D12** | Marketing one-pager / postcard | Claude | Brand deck, copy source | PDF / print-ready | External |

---

## 5. Standard workflow

```
1. REQUEST     Cindy names format (Room Book / Category Book / Tile Packet / other)
2. GATHER      Agent lists required inputs; Cindy provides exports, PDFs, renders, links
3. GROUND      Agent reads Studio state doc + relevant WO; never invent product behavior
4. DRAFT       Agent produces HTML, markdown, or XLSX in repo Docs/ or _backup/
5. REVIEW      Cindy red-lines; agent revises (version bump in filename)
6. PUBLISH     PDF to project Files / Documents; optional portal link for client iPad
7. LOG         Substantive session → SESSION_LOG; data scripts → backup path in log
```

**Never:** agent writes Firestore apply scripts without dry-run + backup + Cindy GO.

---

## 6. Inputs agents can use

### From Studio (staff)

| Input | How to get it |
|-------|----------------|
| Proposal / invoice lines | Open doc in Studio → export/print PDF, or copy Client View link |
| Selections / FFE | FFE Schedule export (admin); Selections tab filtered by room/category |
| Product specs | Product Library → spec URL; tear sheet per line |
| Renderings | Files & Docs; Design Board export; Dropbox project art |
| Plans | PDF from architect (email, Files tab) — **not** in Studio takeoff engine |
| Financial recon | `_debug/` dry-run reports; Houzz Outgoing xlsx (with taxonomy guard) |

### From repo (agents)

| Doc | Use |
|-----|-----|
| `Docs/CCH_STUDIO_CURRENT_STATE_CR_Aug12_v1.0.md` | Feature names, client boundary |
| `Docs/CCH_PLATFORM_RULES_AND_DESIGN_INTENT_CR_Aug12_v1.0.md` | Locked facts (copy-not-link, numbering) |
| `loop/CCH_VOICE_PROFILE_CW_Jul13.md` | Client-facing prose |
| `Docs/CLEANUP_HISTORY.md` | Houzz category taxonomy |
| `loop/OPEN_ITEMS_AUDIT_CR_Aug13_v1.0.md` | What's open |
| `cch-deliverable-formats.md` (Dropbox) | Room / Category / Tile formats |

### From Claude project (when available)

- Rolling Hills jobsite inventory, editorial template, room-book reference layouts
- Pepper master plan, marketing lane handoffs

---

## 7. Voice, brand, and client safety

**Voice:** `loop/CCH_VOICE_PROFILE_CW_Jul13.md` — warm, unpretentious, story-first, **no em dashes**, kill agency-speak.

**Visual:** Navy `#0F1A2E` / `#0A1F3D`, gold `#C4A464` / `#C9A96E`, Playfair + DM Sans (see tear sheet mockups `loop/WO-041_MOCKUP_*.html`).

**Client-safe deliverables must omit:**

- Trade cost, markup, margin, DNET
- PO numbers, vendor bill details, variance internals
- Smart Time, rates, team internal notes
- Unpublished draft proposals

**Room Book → architect:** professional reference tone.  
**Category Book → client:** curated walkthrough.  
**Tile Packet → installer:** construction-grade, sheet numbers, no marketing fluff.

---

## 8. File naming and handoff locations

### Agent-produced files (Cynthia rule)

Never overwrite Cindy’s working spreadsheets. Agent files use:

```
{Descriptor}_BY_{AGENT}_{YYYY-MM-DD}.{ext}
{Descriptor}_BY_CLAUDE_{date}.xlsx
HANDOFF_{topic}_CR_{date}.md
```

### Where to save

| Type | Primary | Copy for visibility |
|------|---------|---------------------|
| Code / canon docs | `C:\dev\CCH-Platform-Deploy\cch-deploy\Docs\` | Dropbox `Studio Claude skills/` |
| Cross-agent handoffs | — | `Dropbox/Claude - CCH studio/Cursor1 to cursor2 Claude Handoffs/` |
| Firestore dry-run backups | `cch-deploy/_backup/{topic}-{date}/` | Path in SESSION_LOG |
| Deliverable HTML/PDF | `Docs/` or project Dropbox art folder | Client via Studio Files upload |

**Code edits:** `C:\dev\CCH-Platform-Deploy\cch-deploy` only — never edit Dropbox repo copy.

---

## 9. iPad delivery (clients read on tablet)

Most clients open the **Client Portal** on iPad, not desktop.

| Deliverable type | Best delivery |
|------------------|---------------|
| Category Book, Room Book (client-facing) | PDF in **Documents** + WO-114 portal polish |
| Bi-weekly Updates | Portal **Updates** tab (landscape); WO-047 live data |
| Proposals / invoices | Portal Client View — not a static PDF unless requested |
| Tear sheets / spec links | Per-line links or Documents bundle |
| Tile Packet | PDF to installer (email); not client portal |

**WO-114** tracks portal iPad-first QA. Agents should export PDFs at **letter or landscape** with readable 14px+ body for tablet viewing.

---

## 10. Agent roles (who does what)

| Agent | Best for |
|-------|----------|
| **Claude (Cowork / Team)** | Room/Category/Tile editorial layout, voice polish, marketing copy, long audits, Vanessa Q&A |
| **Cursor** | Grounded code changes, dry-run scripts, HTML deliverables tied to repo, deploy queue, SESSION_LOG |
| **Fable** | Staging verify, screenshot QA on iPad, design-board / portal UX sign-off |
| **#1 Deploy Master** | Commit, staging/prod deploy — agents queue via `_DEPLOY_QUEUE.md` |

**Split example — Room Book:**

1. Cindy exports selections + renderings  
2. Claude drafts narrative + section structure per `cch-deliverable-formats`  
3. Cursor builds HTML/PDF in editorial chassis  
4. Cindy approves → upload to Files → optional portal Documents  
5. Fable verifies on iPad if client-facing  

---

## 11. Prompt templates

### Room Book (Format A)

```text
Produce a CCH Room Book for {project} / {room}.
Format: locked Format A (one room, all categories). Audience: architect.
Use cch-deliverable-formats + editorial chassis. 16+ pages.
Inputs: [paste export, attach renderings, list categories present]
Output: HTML suitable for PDF print. Navy/gold, Playfair + DM Sans.
No trade cost or margin. Filename: RoomBook_{project}_{room}_BY_CLAUDE_{date}.html
```

### Category Book (Format B)

```text
Produce a CCH Selections/Category Book for {project} / {category}.
Format: locked Format B. Audience: client walkthrough. 10–15 pages.
Include: palette plate, room-by-room sections, open items, schedule reference.
Voice: CCH_VOICE_PROFILE gear 1 (warm, bullets, no em dashes).
```

### Tile Packet (Format C)

```text
Produce a Tile Packet for {project} / {scope rooms}.
Format: locked Format C. Audience: installer. Dense.
Attach: plan PDF reference. Use sheet IDs K-/S-/R-/V-/O-.
Include takeoff table: [agent fills from plan if Cindy uploaded PDF]
```

### Takeoff only (no Studio feature)

```text
From the attached floor plan PDF, produce a tile takeoff spreadsheet.
Rooms: {list}. Output: XLSX *_BY_CLAUDE_{date}.xlsx with room, area sf, tile SKU column (blank if unknown), notes.
Do not write to Firestore. Cindy will review before any Studio entry.
```

### Status / open-items audit

```text
Reconcile open WOs from loop/LOOP_LEDGER.md + _DEPLOY_QUEUE.md.
Output: OPEN_ITEMS_AUDIT structure. Note project-only docs unread.
```

---

## 12. Studio features agents should know about (use, don’t rebuild)

| Studio feature | Agent uses it for |
|----------------|-------------------|
| Tear sheets (`generateTearSheetsFromDoc`) | D4 product sheets — prefer Studio print when lines are live |
| E-Spec wizard (`#/especs`, `#/project/.../specbook`) | D5 when `specUrl` populated on Studio-native clips |
| Progress Updates (`cch-progress-updates.js`) | D7 — agent polishes after WO-047 assembles live data |
| `draftInvoiceSummary` | D10 — DS invoice Client View narrative |
| FFE Schedule export | D2, D6 line sources |
| Client portal Documents | Final publish target for PDF deliverables |

---

## 13. Houzz parity — agent answers

| Houzz markets | CCH answer |
|---------------|------------|
| AI takeoffs | Agent spreadsheet from plan PDF (D6) |
| AI 3D floor plans | Design Board + renderings; agent Room Book — no in-app 3D |
| AI weekly client updates | Studio Updates tab + WO-047 + voice (D7) |
| AI clipper | Chrome Clipper + future WO-094; agent can enrich scraped HTML offline |
| Mobile app | Client portal PWA + WO-114 iPad-first |
| AI estimate from voice | Not target market; agent can draft **design-services** proposal outline only |

---

## 14. Checklist before calling a deliverable done

- [ ] Correct format (A, B, or C) — not a invented fourth type  
- [ ] Voice profile applied for client-facing copy  
- [ ] No cost/margin/PO internals in client/architect-wrong-audience docs  
- [ ] Filename uses `*_BY_{AGENT}_*` if spreadsheet  
- [ ] Copy saved to Dropbox handoff if cross-agent pickup needed  
- [ ] Cindy review step — no auto-publish to portal  
- [ ] If iPad client doc: readable at portrait width without zoom  
- [ ] SESSION_LOG if substantive (protocol in `nightly-session-log.mdc`)  

---

## 15. Related WOs and docs

| Ref | Topic |
|-----|-------|
| WO-114 | Client portal iPad/mobile-first |
| WO-047 | Build-from-project bi-weekly updates |
| WO-046 | RFQ to vendor (Studio) |
| WO-048 | Unify tear-sheet engine (Studio) |
| ESPEC_BOOK_BUILDER_BRIEFING v2.1 | Spec book delta spec |
| WO-113 | Selections sync (data for deliverables must be correct in Studio first) |

---

*Playbook v1.0 — Aug 17, 2026. Update when Cindy locks new formats or Studio ships WO-047/114.*
