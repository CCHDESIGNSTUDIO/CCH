# WO-092 · Product Library duplicates still show in the proposal Add-item → Products picker · CW Aug 06
**Change ID:** pending #1 · **Lane:** Studio platform (Product Library + Add-item picker) · **State:** OPEN · **Executor:** Part 1 (display dedupe) Cursor — small index.html edit; Part 3 (data cleanup) Code/script — data op · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html`. Grounding (canonical tree, HEAD 3d92702): the Products tab is fed by the `libraryProducts` array; picker render/filter `renderSelPicker` (~42519) / `filterSelPicker` (~43932); add-item modal (~40819–41367, tabs Project Selections / Products / Design / Labor / Expenses, "Pull full room board" / "Blank line"). **Products are dual-written to BOTH `db.collection('products')` and `db.collection('productLibrary')` (~11451–11452)** — a prime duplicate source. **Staging first; minimal diff; re-ground exact lines before editing.**

## What Cindy hit
In a proposal, **Add item → Products**, the same product shows multiple times: "Long T Profile Rectangular Knob" ×3 (Ashley Norton, $41.87), "MIX Diamond Knurled Appliance Pull" ×2 ($819), "Urban 8" Center to Center Handle" ×2 (Ashley Norton). Her words: "I thought we fixed this — all of the copies should not show up in the product library." (There was a product-library remediation on 2026-07-05 and WO-078; it did not hold.)

## Why (grounded — Cindy was right, it WAS built)
The promote-to-library path (~24660) ALREADY calls **`cchFindExistingPromoteTargets(pid, pageUrl, roomName, libraryProductId, {title, vendor})`** and, on a hit, **updates** the existing product (`db.collection('products').doc(libraryProductId).update(...)`) instead of creating. So dedupe-on-add exists. **The copies slip through because that match keys mainly on the source `pageUrl` and an existing `libraryProductId` link.** When the same product arrives WITHOUT a matching URL/link — clipped separately, added manually, or from a different room clip — the match misses and `ibCreateLibraryProductFromIdeabookItem` **mints a new library doc.** That's why "Long T Profile Knob" appears 3× (same product, different clip origins). Secondary: the picker `libraryProducts` list also doesn't dedupe on display, and may double-count a product living in both `products` and `productLibrary`.

## Fix
### Part 1 — Dedupe the picker on display (contained, do first — Cursor)
1. In the Products picker list build (`renderSelPicker` / `filterSelPicker` off `libraryProducts`), **collapse entries that are the same product to ONE row.** Dedupe key by stable identity: shared library key / (vendor + SKU) first, else (vendor + title + price). When several collapse, keep the best record (has image, has QB category, most complete).
2. **Dedupe across the two collections** so a product living in both `products` and `productLibrary` appears once.
3. This immediately stops the copies showing without touching data.

### Part 2 — Broaden the existing match so it stops minting twins (root cause — Code)
4. **Widen `cchFindExistingPromoteTargets` (~24660)** so it also matches on product identity — **vendor + title (+ SKU)** — not just `pageUrl` / `libraryProductId`. Then a product clipped separately, added manually, or from a different room resolves to the existing doc and **updates** it (the update path already exists) instead of creating a new one. Guard against false merges: require vendor + a strong title/SKU match, not title alone.

### Part 3 — Clean up the existing dupes (data op — Code/script, careful)
5. A **non-destructive remediation pass** to merge existing duplicate library docs: pick one canonical per identity, merge `libraryUsageRefs`, repoint references, then retire the extras. **Back up first; verify before/after counts; do NOT blind-delete.** (This is what 2026-07-05 did but it regressed — gate the create path in Part 2 so it holds this time.)

## Guardrails
1. **Do not collapse genuinely distinct products.** Two different SKUs that happen to share a title must stay separate. Identity match must include vendor + SKU (or price) — not title alone.
2. Don't break the **"ON DOC" badge**, price, QB category, image, or add-to-proposal behavior on the surviving row.
3. **Data is non-destructive** until verified: Part 3 merges and backs up, never blind-deletes. Staging first, then a counted verify.
4. Display dedupe (Part 1) and data cleanup (Part 3) are independent — ship Part 1 now for instant relief; Part 3 is the durable fix.

## Acceptance (Fable, staging screenshots)
1. Add item → Products: each real product appears **once** (one Long T knob, one MIX pull, one Urban handle), while genuinely distinct SKUs remain separate.
2. Adding a product to a proposal still works; price, ON DOC badge, QB category intact; no console errors.
3. Part 3: before/after library counts reported; no product lost; usage refs preserved.
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-092 · Product Library duplicates in Add-item Products picker — dedupe the picker on display (identity = vendor+SKU/title+price, across both `products` and `productLibrary`), existence-gate the create path, and a non-destructive merge pass for existing dupes · Part 1 Cursor / Part 3 Code · staging first.
