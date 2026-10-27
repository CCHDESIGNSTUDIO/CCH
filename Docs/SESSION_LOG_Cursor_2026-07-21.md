# Session Log — Cursor: Clipper images + proposal price save race

**File:** SESSION_LOG_Cursor_2026-07-21.md  
**Created:** July 21, 2026  
**Author:** Cursor (CR)

## Overview

1. Clipper full-size image URL upgrade (3.9.50) then image-pick fix (3.9.51) — Chrome reload only (not Firebase).
2. Proposal Edit pricing not sticking (Cindy: changed ~20 times on PRO-3025) — race + remount wipe.

## Grounding (price save)

- `updateProposalItemField` / `_updateProposalItemFieldBody` — `platform/index.html` ~8324
- Each field `onchange` did `get()` full `items` → patch one field → `update` → `renderProposalDetail` remount
- Rapid COST then Mkup then TOTAL: later write could overwrite earlier; remount wiped in-progress typing
- `proposalDesignerLineEditLocked` (`:33811`) locks pricing when `clientApprovedTotalAt` set — now surfaced with alert on pricing fields (was previously silent only on other save paths)

## Change (v9.8.96)

- Per-doc save queue so field writes run one after another
- Remount Client/Manage detail only after queue drains
- Sync `clientPrice` when `amount` / cost×markup recalc
- One “Price saved” toast when a pricing burst finishes
- Build tag: `proposal-price-save-queue-2026-07-21`

## Deploy

- Clipper: extension reload (done earlier)
- Platform **v9.8.96** — queued **staging** in `_DEPLOY_QUEUE.md` — **not deployed** until #1 / Cindy
- Production — needs typed GO after staging verify

## Verify (after staging)

1. Hard refresh staging → sidebar **v9.8.96**
2. Edit Proposal (unlocked): change COST, Tab to Mkup, change Mkup, Tab to TOTAL — all should stick; toast once
3. Done editing → Client View PRICE/TOTAL match
4. If proposal has client-approved total: should get clear “Cannot save price” modal (not silent fail)

## Also (v9.8.97) — Product Library delete/update

Cindy (admin): List view had **no Delete** (only Edit) — so delete never ran / no confirm. Trade cost needs tab-out to save.

**Fix:** Delete column on list; `deleteProduct` uses `cchConfirm`, deletes `products/` + `productLibrary/` independently, always surfaces errors; clearer pricing save errors.

**Deploy:** queued staging with 9.8.96 — not prod.

## Builder fabric picker — ft009 + ft010 (Cindy GO)

**ft009:** Modal junk (Freight/bedding) + broken thumbs — blank-category clips flooded grid; missing `referrerpolicy`. Strict Fabric & Trim Product Library list, search, no-referrer images.

**ft010 (Cindy “go ahead”):** Materials layout matches intended model:
- **COM** → primary **Choose from Product Library** + yardage
- **Vendor** → upload swatch + part #
- Removed confusing Vendor Fabrics Library block above material rows on product templates
- Banner: COM = Product Library · Vendor = upload
- Meta: `cch-builder-rev` = `2026-07-21ft010-com-vendor-materials`

**ft011 (Cindy “go ahead”):** Every Material **A–D** shows two chip groups at top:
- **Source:** COM | Vendor
- **Type:** Fabric | Trim (replaces buried trim checkbox; same `slotKind` / `fabricSlotKinds`)
- Meta: `2026-07-21ft011-fabric-trim-chips` · parse OK

**Deploy:** queued staging — **not deployed**. Hard-refresh Builder after #1 ships.

## Katke work orders (Vanessa bug ticket)

**Probe (prod SA):** Early = 0 Katke WOs. Later **1** appeared: `KAT-U-01` (upholstery, Living Room, doc `Hp29zQA4EvVX5SMACVRR`). Vanessa thought **2** — no second found firm-wide. Autosave drafts stay in **localStorage** until **Save work order**.

Scripts: `_scripts/probe-katke-workorders_BY_CURSOR_2026-07-21.js`, `probe-all-workorders_*`, reply on feedback `YHWJDuC5ckG0MXsDUrdp`.

## Work order Delete (v9.8.98 / builder ft012)

Cindy: Delete missing on custom work orders. Grep: no `deleteWorkOrder` in repo; Studio Actions were Print/Open/Duplicate only; Builder had Duplicate/Reset only.

**Fix:** `deleteProjectWorkOrder` + per-row Delete + Delete selected on Work Orders tab; Builder `deleteCurrentWorkOrder` button when a saved WO is open. Confirm via `cchConfirm` (danger). Firestore doc only; proposal fabric lines untouched.

Queued staging — not deployed.

## Katke client merge + PRO-3034 OC tax (prod APPLY)

Cindy GO: one Shelley client; OC tax on PRO-3034.

- Script: `_scripts/merge-katke-clients-apply-oc-tax-PRO3034_BY_CURSOR_2026-07-21.js`
- Backup: `_backup/katke-client-merge-2026-07-21/BACKUP_before_apply.json`
- Kept `shelley-katke` (phone from Shelly); deleted `shelly-katke`, Garza C/O client, stub `katke`
- Linked Graceland / Nashville / Puerto Vallarta → `clientId: shelley-katke`
- PRO-3034: `taxRate` 7.75 (OC), tax $419.48, total $9,894.58 (was $9,475.10)

## Loop registration (Builder field WOs)

Cowork Dropbox drafts WO-003…006 collided with canonical ledger → registered as **WO-049-B…053-B** (BF-009, FT-012…015). **`-B` = Builder lane** (Cindy).

## Builder loop executed (Jul 22 morning)

All five DONE-UNVERIFIED in `platform/builder/index.html` rev **ft016**:
1. WO-049-B / BF-009 — library price aliases + ensure catalog before Create Proposal
2. WO-050-B / FT-012 — collapsible sections + `builderSectionCollapse` localStorage
3. WO-051-B / FT-013 — Application field A–D (aliases materialUse)
4. WO-052-B / FT-014 — simplified pillow Design specs + `pillowSpec`
5. WO-053-B / FT-015 — beddingSpec room + Option 1–3 lines

**Queued staging** `_DEPLOY_QUEUE.md` 10:55 line — tell #1 to deploy. Not production.

## Open

- Clipper v3.9.51 — reload extension (not Firebase)
- Staging verify WO-049-B…053-B after #1 deploys
- Katke #2 WO: only if Vanessa has PDF / browser draft

