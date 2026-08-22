# WO-094 · Launch the clipper on an EXISTING library product to add more images · CW Aug 06
**Change ID:** pending #1 · **Lane:** Inspiration hub / Product Library (clipper) · **State:** OPEN · **Executor:** Code/Cursor (reuses the existing update path — small once wired) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html`. Grounding (canonical, HEAD 3d92702): the update-existing path already exists — `cchFindExistingPromoteTargets` (~24660) → on a hit, **`db.collection('products').doc(libraryProductId).update({...})`** (~24672). Product detail view `showProductDetail(id)` (~6022). Images live as `photoUrls` / `productPhotos` arrays on the product. **Staging first; minimal diff; re-ground exact lines.** Pairs with WO-092 (same match/update machinery).

## What Cindy asked
"Is there any way we can update an existing product by launching the clipper so we can add more images?" When she's on a product that's already in the library, she wants to open the clipper **targeting that product** and have the new images **append** to it — not create a new library entry.

## Change
1. On an **existing product** (start with the Product Library detail via `showProductDetail`; optionally a proposal/room-board line's product too), add an **"Add images (clipper)"** action.
2. That action **launches the clipper bound to the existing `libraryProductId`** — an "add to this product" mode, not a fresh clip-to-new-product.
3. New clipped images **append** to that product's image array (`photoUrls` / `productPhotos`), reusing the existing product-update path (~24672). **Do NOT create a new product doc.**
4. On finish, the new images show on the product immediately (no refresh), and the count reflects them.
5. **Stamp a Studio ID (Cindy, Aug 06).** When a product is updated/curated this way and doesn't already have one, assign a **Studio ID** — a stable, unique, human-readable CCH identifier (e.g. `CCH-00123`) — so the team can see at a glance the product has been curated/updated in Studio, not a raw clip. Assign **once**, never changes. **Display it as a circled-S badge — Ⓢ — a navy circle with a gold "S" (Option A, confirmed by Cindy Aug 06: `#1f2a3d` circle, `#C4A464` "S", Georgia serif, ~20px in lists)**, shown next to the product everywhere it appears (Add-item picker, product detail, room board), with the Studio ID + "Curated in Studio" on hover. The badge instantly signals the product has been curated/updated in Studio (vs a raw, un-curated clip). This Studio ID also becomes the **canonical identity WO-092 collapses duplicates toward** (matched twins merge into the one that holds the Studio ID).

## Guardrails
1. **Never create a new product in this mode.** The whole point is to update the existing one; the clipper must carry the target `libraryProductId` through and use the update path.
2. **Append, don't overwrite.** Existing images stay; new ones are added. No dupes of the same image (dedupe by URL on append).
3. Keep the product's identity, price, category, vendor, SKU untouched — this only adds images.
4. Images to Studio storage (same-origin, permanent), per the WO-079 lesson — don't hotlink.
5. Reuse the existing clipper UI and the existing update path; do not fork a parallel clipper.
6. **Studio ID must be collision-proof and assign-once.** Generate uniquely (a counter doc or equivalent — heed the WO-064 genId collision lesson); never reassign or duplicate an existing Studio ID; a product that already has one keeps it unchanged.

## Acceptance (Fable, staging screenshots)
1. From a library product, "Add images (clipper)" opens the clipper; clip 1-2 images; they append to **that same product** (image count goes up), and **no new library doc is created** (product count unchanged).
2. Existing images preserved; no duplicate image rows; price/category/vendor unchanged.
3. No console errors; images persist after reload.
4. Updating a product stamps a unique **Studio ID** (if absent), it shows on the product + picker, doesn't change on further edits, and no two products share one.
5. The **circled-S badge (Ⓢ, navy circle / gold S, Option A)** renders next to any product that has a Studio ID (picker, product detail, room board); hover shows the ID + "Curated in Studio." Products without a Studio ID show no badge.
6. After the backfill (post WO-092 merge): **every** Studio-curated product shows the Ⓢ badge and carries exactly **one** Studio ID; no duplicate holds its own separate ID; before/after counts reported.

### Apply to ALL Studio clips (Cindy, Aug 06) — backfill
6. **Backfill a Studio ID onto every existing Studio-curated product** so they all carry the Ⓢ badge, not just newly-updated ones. **This is a data pass — Code/script, non-destructive, back up + counted verify.**
7. **Order of operations (critical):** run the **WO-092 dedupe/merge FIRST**, THEN assign/backfill Studio IDs, so each **canonical** product gets exactly **one** Studio ID and duplicates (about to be merged) are never stamped. Assigning IDs before the merge would defeat the whole point.
Screenshots (before/after image count + library count) to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-094 · Launch clipper on an existing library product ("Add images") — appends to that product's images via the existing update path (~24672), never creates a new doc; reuse clipper UI, dedupe images by URL · Code/Cursor · staging first.
