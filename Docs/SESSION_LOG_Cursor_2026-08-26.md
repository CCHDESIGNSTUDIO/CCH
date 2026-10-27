# Session log — Cursor — 2026-08-26

**Agent:** Cursor (Grok) #1 Deploy Master  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Overview

Cindy GO production for yesterday’s PO→QB hotfix: unit cost × qty (not cost÷qty) + project customer on PO lines.

## What changed

### Production functions ~11:15 (Cindy GO)

Deployed to `cch-design-boards`:

- `pushPOToQB`
- `pushBillToQB` (same `ensureQbPurchaseOrderForStudioPo` helper)

New QBO POs: Rate = Studio unit `cost`, Amount = cost × qty; each line `CustomerRef` + `ShipAddr` from the project’s QuickBooks customer. Existing POs (PO-9019 / PO-9044) are not overwritten.

### Sidebar open-PO count — Studio **9.9.268** — **PRODUCTION** hosting 2026-08-26 ~16:15 (Cindy GO)

- **9.9.267** staging: firm-wide left rail `#/allpos` badge (fills after All POs / dashboard load `_cachedPOs`).
- **9.9.268** staging ~16:05 then production ~16:15: project panel **Purchase Orders** badge = this job’s open POs. Cache `cch-project-subpanel.js?v=20260826sp16`. Cindy verified on staging project page.

Not committed.

### Received date on vendor shipments — Studio **9.9.270** — **staging** hosting ~16:35

Edit vendor bill shipment blocks now have **Received date** next to ETA (per vendor invoice). Save does not mark the whole PO Received. Line Ship/ETA shows Received when set.

### Project PO list Received + ETA — Studio **9.9.271** — staging (not production)

Cindy: checkbox + change ETA on the project PO list; Airtable later (baby steps).

- Shipping cell: existing badge + **Received** checkbox (`cchPoListShippingCellHtml`). Check → `cchPoSetFulfillmentStatus(..., 'Received')`. Uncheck → Pending. Whole-PO, not per-line. Does **not** call `pushPOsToAirtable`.
- ETA cell: date input (`cchPoListEtaInputHtml`) → same save as Order Management (`cchOmSaveEtaDate`). Also on Finance → All POs ETA column.
- Cache `cch-po-bill-variance.js?v=20260826listrecv1`.

Not committed. Production hosting still **9.9.268** until Cindy GO.

## Open items

- Visual Comfort: one QB Bill per vendor invoice still needed for Match.
- Airtable write-back when Received / ETA changes (next step after Cindy confirms Studio list).
- Do not commit unless Cindy asks (shared working copy).
- Production GO needed for **9.9.271** list Received/ETA.

## Verify commands

1. Send a **new** Studio PO (not one already in QB).
2. In QuickBooks: Rate = unit cost; Amount = cost × qty; Customer column filled.
3. Leave Fancy Concrete POs as already edited.
