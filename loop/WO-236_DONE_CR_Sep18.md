# WO-236 DONE — Library image → Rolling Hills Selections

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-18  
**Change ID:** 9.9.351 (hosting staging) + production Firestore clip images

## Symptom

Cindy: “the product library did not update the project selections.”

## Grounding (this turn)

- Isolation: library save does not write clips (`index.html` product save comments).
- `plApplyLibraryImageImpact` clip branch (`index.html:12875`) only set/cleared `imageUrlOverride`.
- Selections thumbs (`_selectionsItemThumbUrl` `index.html:65201–65207`) use clip `imageUrl` / `image` / `images[0]` first — never live library, never override when the clip already has a photo.
- `_pdUploadImage` (`index.html:70581`) wrote the library only. Camera / detail upload never opened the Apply new image modal. Bulk already passed `{ skipImpactModal: true }` (dead third arg until this WO).
- Library rows she updated today (not Large Rec):
  - `QtMhnee1hurOGMoUUhj7` Modern Vale Tall Lantern
  - `SvwMl1gIAsJIsA3aPaiJ` Vertical Sconce Rectangular
  - `Vba2v8UykZ1LaILgRmWB` Summit Single Sconce
- `plCollectLibraryProductRefsForImpact` still skips `pr.published` / `inv.published` — sent PRO-3025 / INV-6067 not in the modal. Left those docs alone (no GO).

## Change

**Data (production Firestore, money unchanged):** copied library `imageUrl` + `images` onto RH clips:

| Clip | Room | Product |
|------|------|---------|
| AhRkEn46NbPTPSPV7b10 | Powder 1 | Summit |
| b7FvNpgs0TzSdKrlZbdG | MBR & Bath | Summit |
| lnxcVeCyB2FXtsKpihOb | (blank) | Vertical |
| xCoRrpFCdelO8Nr5cDfJ | Dining Room | Vertical |
| JBzTC6tLnMSoVOlXrpjy | Kitchen | Modern Vale (second copy after she replaced the library photo again) |

Backups: `_backup/wo236-rh-lib-images-2026-09-18T22-46-13-408Z/` and `...T22-48-01-940Z/`.

**Code (`platform/index.html`):**

1. Clip Apply now writes `imageUrl`, `image`, `images[]` (new hero first), clears override (`plApplyLibraryImageImpact` ~12875–12899).
2. `_pdUploadImage` honors `opts.skipImpactModal`; single upload opens the same Apply new image modal. Tear import passes skip.
3. `CCH_BUILD` **9.9.351**.

## Surfaces

- **Intended:** Product Library → Selections (clips) when she applies the new image.
- **Must not:** sent proposal/invoice/PO line photos; paid invoices; money fields.

## Self-test

- Re-probe after second apply: Summit + Vertical clips `sameHero: true`. Kitchen Vale written to latest library file `1789771587375.png`. Costs unchanged (1975 / 2775 / 2150).
- Index.html tail still `</body></html>`.
- No `node --check` (edits are inside `index.html` only).

## Verify

Production (data already live): Cloud Rolling Hills → Selections → Ctrl+Shift+R. Summit (Powder 1 + MBR), Vertical (Dining + unroomed), Kitchen Modern Vale should match Product Library heroes.

Staging (after #1 deploys 9.9.351): Product Library → Replace image or camera on a product that is on a **draft** selection → Apply to selected → Selections thumb matches. Sent invoice/proposal still skipped by the modal.
