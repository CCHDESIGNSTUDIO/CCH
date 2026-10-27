# Session Log — Cursor: Custom Builder upholstery WO Phase 1+2

**File:** SESSION_LOG_Cursor_2026-07-08.md
**Author:** Cursor
**Created:** July 8, 2026
**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`
**Branch:** `staging-fixes-2026-07-08`
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app

---

## Session overview

Cynthia approved **Custom Builder Phase 1 + 2 + 3** — blending Parsons/Scarborough (2016 PPT) and Park City Promontory (2023 PDF) reference work orders with window-WO builder patterns.

---

## What changed

| Area | Change | File |
|------|--------|------|
| Phase 1+2 (prior) | Main image hero, picker detail slots, Project library → Fabric A sync | `platform/builder/index.html` |
| **Phase 3 header** | `PROJECT · DATE · REV · QTY` meta line; **TAG / PR# / Suite** field; **room · piece** title (e.g. GREAT ROOM · Sofa) | same |
| **Fabric coverage** | **COM (YRD)** + **COL (sq. ft.)** on fabric rows and preview | same |
| **Parsons nail heads** | Nail head **A / B** rows (vendor, SKU, spacing note) in Details & Trim + preview | same |
| **Promontory callouts** | **Stitch detail** + **Wood finish** reference uploads; hero callout badges | same |
| **Persistence** | `pieceQty`, `nailHeadDetails`, `date` added to Firestore save payload | same |

Reference decks reviewed (local extract only): Parsons Fairway PPT, Scarborough PPT, Promontory PDF.

### Deploy

- **NOT deployed** — queued for #1 staging hosting.
- **NOT committed** — per standing policy.

---

## Verify after staging deploy

1. Hard refresh staging → Custom Builder → Upholstery WO.
2. Set **TAG / PR# / Suite** (e.g. `PR#2`), **Piece quantity** (e.g. `2`), room, piece spec → preview shows `PROJECT · DATE · REV · QTY` and `ROOM · PIECE` title.
3. **Vendor fabrics** → Project library → confirm Fabric A + vendor column + **COM/COL** boxes.
4. Fill **Nail head A/B** → prints in Vendor materials column.
5. Upload **Stitch detail** / **Wood finish** refs → callout badges + thumbs under hero.
6. Print/PDF — compare layout to Parsons headboard + Promontory sofa pages.

---

## Open / next

- Optional **Phase 3**: further trim duplicate picker sections (banding, welt, etc.) if desired.
- Production deploy only on Cindy explicit GO.

---

## Queue line

```
[2026-07-08 22:10] Cursor Custom Builder — platform/builder/index.html — staging — Upholstery/bedding/pillows Phase 1+2 — STATUS: pending
```
