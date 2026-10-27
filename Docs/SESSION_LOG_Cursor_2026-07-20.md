# Session Log — Cursor: Inspiration lightbox tiny images (CP108)

**File:** SESSION_LOG_Cursor_2026-07-20.md  
**Created:** July 20, 2026  
**Author:** Cursor (CR)  

## Overview

Cindy: Bugle Trail inspiration lightbox showed a tiny lamp image in a large navy stage (“tiny pictures” again on clips from today).

## Grounding

- Lightbox HTML: `ibShowImageDetail` → `#ibLbMainImg` (`index.html` ~26540)
- CSS was: `.ib-lb-image-area img { max-width:100%; max-height:100%; object-fit:contain }` — does **not** upscale small intrinsic thumbs
- Known as **CP108** (Jun 5 session log); client proposal lightbox already uses `width/height:100%` + contain

## Fix

`platform/index.html` + `platform/client.html`: image area fills stage with `width/height: 100%` + `object-fit: contain`.

## Deploy

- Staging: done 2026-07-20  
- Production: waiting Cindy GO (Bugle Trail is prod data)

## Verify

Hard refresh → open inspiration item → image should fill the left navy panel (letterboxed if needed, not a postage stamp).

---

## Later same day — Proposal Landing COST leak

**Symptom:** Cost showing on proposal landing Client View.  
**Grounding:** `renderProposalDetail` Client View branch (`index.html` ~31751 / thead ~31822) still rendered COST header + `formatMoney(cost)` cells.  
**Fix:** Removed COST from Client View + Manage landing tables; Cost only in Edit Proposal. Build v9.8.88. Staging + production deployed 2026-07-20 15:25.

---

## Later same day — Client portal Cost harden (Cindy: “Clients have access via their portal”)

**Symptom / clarification:** Real client surface is `client.html` portal, not only Studio Client View.  
**Grounding:**
- Premium portal proposal table `_cpPremTableHead` (`client.html` ~8086) — Item / Qty / Price / Shipping / Tax / Total / Decision — **no Cost** (safe path).
- Legacy portal preview `_previewDocumentOriginal` (`client.html` ~5315 / ~3834) shows Cost when `!prevH('cost')`.
- `getClientHiddenColumnList` previously honored saved `clientHiddenColumns` verbatim — if Cost was unchecked in Edit Proposal, Cost could show on portal preview/print.

**Fix (v9.8.89):**
- `getClientHiddenColumnList` in `index.html` + `client.html` — always force-merge `cost` + `markupPct`.
- `saveProposalMetaFromModal` — always persist those keys hidden.
- Edit Proposal modal — Cost / Markup checkboxes locked (disabled) with “always hidden from clients”.

**Deploy:** queued staging — `_DEPLOY_QUEUE.md` STATUS: pending. **Not production** until Cindy GO.  
**Verify:** Hard refresh portal → open published proposal (e.g. PRO-3011) → no Cost / Markup columns. Also Preview/Print from studio share path.

---

## Later same day — Cleared Cost still in Total

**Symptom:** Cindy deleted Cost on a proposal line; Total still showed the old dollar amount.  
**Grounding:**
- `recalcProposalLineAmount` (`index.html` ~8214) only updated `amount` when `cost > 0` — clearing cost left stale `amount`.
- `docEditNumChange` zeroed `amount` but `docEditRecalcTotals` (~37603) uses `(cost === 0 && sell > 0) ? sell` and resurrects sell from `clientPrice` / `totalSelling`.

**Fix (v9.8.90):** On cost clear, zero `amount`, `clientPrice`, and `totalSelling` (service+rate exception).  
**Deploy:** queued staging. Re-clear Cost on the line after deploy (or set Cost to 0 and tab out) to flush already-stale fields.
