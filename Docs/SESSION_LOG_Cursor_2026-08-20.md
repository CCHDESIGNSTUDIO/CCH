# Session log — Cursor — 2026-08-20

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Branch:** wip/preserve-rh-inspiration-board-2026-04-19 (shared Machine-1 working copy)

## Overview

Cindy: every proposal/invoice line **with a room** belongs on that room board; **no room** stays in Project Selections. Shipped Place on Room Boards (per document + Check all), Qty on cards, Showrooms/Subs, then production **9.9.234**. Afternoon: cleaned the working bug list, then rewrote the Aug 12 copy-clip / Pepper-facts WOs so they cannot be re-implemented.

## What changed

### Client portal iPad Home (Studio **9.9.240**) — staging queue

- Home no longer injects every room-board product card/image into hidden HTML (Rolling Hills / Tracey Cloud iPad freeze).
- Room tiles only; tap a room for products. `loading=lazy` on remaining portal images.
- Time entries (up to 2×1200) load only on the Progress page.

### Add-item library speed (Studio **9.9.238**) + Approve/Decline speed (**9.9.239**) — staging queue

- Products picker: first 500 paint immediately; catalog cached; 80-row cap.
- Approve/Decline: no full proposal reload; no all-clips collection scan. Pills update in place. Clip/library sync is background.

### Spec Book product invoices only (Studio **9.9.237**) — staging done ~14:06

- Invoice source in E-Spec Book skips design-services / hours invoices (`cchInvoiceUsesDesignServicesLayout` / `cchIsPureDesignServicesInvoice`).
- Mixed invoices keep furnishings only (`_tearSheetLineIsProduct`). Empty after filter → invoice omitted.
- Cache `_sbDataVer` 3 → 4 so lists reload.

### Spec Book TAG # + technical docs after cut sheet (Studio **9.9.236**) — staging done ~14:06

- Cards/list/review/print now show invoice/clip **TAG #** (`lineTag` / `fixtureTag` / `itemCode`).
- Export **Supporting Documents** actually prints: images as pages; PDFs rasterized via pdf.js so they appear after that item’s spec sheet.
- Uploads stamp `clipId` and reattach to invoice lines on reload.

### Category remap + Pepper Pay fact (Studio **9.9.235**) — staging done ~14:06 / functions ~14:08

- `cch-product-categories.js`: MASTER match before remap. Stop rewriting Floor Covering / Florals / Wall off MASTER. Legacy `Flooring` / `Tile & Stone` / `Plumbing & Appliances` heal toward MASTER.
- Builder `BUILDER_LIBRARY_CAT_NORM` aligned (it still had Stone & Tile → Tile & Stone).
- `Functions/cchPepper.js:98`: clients pay Square hosted checkout or Zelle; QB is SoT for paid/balance; no card fields in Studio.
- Docs WOs rewritten in place: original field-carry / facts-block are SHIPPED; follow-up only.
- Needs staging **hosting** + **`functions:cchPepper`**. Prod on Cindy GO.

### Place per document + Qty (Studio **9.9.234**) — PRODUCTION hosting 2026-08-20 ~10:26 (Cindy GO)

- Staging hosting ~10:12 first.
- Place on Room Boards = **this document**; Options = **Check all documents**.
- Room-board cards always show **Qty**.
- Bundled Showrooms + Subcontractors pages (**9.9.233**).

### Earlier same day (also in 9.9.234 prod)

- **9.9.232** Place on Room Boards (project-wide first pass)
- **9.9.231** proposal/invoice line cost+sell → linked clip only
- **9.9.230** showroomVendor / Clipper 3.9.55
- **9.9.229** clip save money as numbers (WO-118)
- **9.9.228** copy-to-room field carry

## Bug-list cleanup (~11:56)

Do not start from Dropbox Excel or the Aug 13 board. Working list: canvas `dropbox-bug-priority.canvas.tsx`.

- **Closed this morning (hosting):** 228–234 as above.
- **Next (Cindy pick):** CLIP-3 finishes/SKU (needs GO) or WO-026 brown boxes.
- **Confirm then close:** HOTFIX-032 payment Edit (`index.html:44268`); WO-034 QB fee tax; SEL-1 a/b/c; WO-117 Ember collisions.
- Ledger: HOTFIX-032 → DONE-UNVERIFIED; WO-116 / WO-118 notes → PROD 9.9.234.

## Deploy

| Item | Target | Status |
|------|--------|--------|
| **9.9.234** (includes 228–233) | staging hosting | done ~10:12 |
| **9.9.234** | production hosting | done ~10:26 Cindy GO |
| **9.9.235** remap + Pepper Pay fact | staging hosting + `functions:cchPepper` | done (hosting ~14:06; functions:cchPepper ~14:08) |
| **9.9.236** Spec Book TAG + tech docs | staging hosting | done (~14:06, bundled in 9.9.237 file) |
| **9.9.237** Spec Book product invoices only | staging hosting | done (~14:06) |
| **9.9.238** Add-item library first page | staging hosting | done (~08:11, bundled in 9.9.240) |
| **9.9.239** Approve/Decline speed | staging hosting | done (~08:11, bundled in 9.9.240) |
| **9.9.240** Client portal iPad Home | staging hosting | done (2026-08-21 ~08:11) |
| Auto-create tiles on every line save | — | Not this pass; button first |

## Guardrails

- No commit/push (shared working copy)
- Isolation: library still not written; Place on Room Boards is explicit
- POs not scanned
- CLIP-3 not coded until Cindy GO
