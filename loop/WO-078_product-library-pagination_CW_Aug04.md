# WO-078 · Product Library — real pagination (page through all products) · CW Aug 04
**Change ID:** pending #1 · **Lane:** Studio platform · **State:** OPEN · **Executor:** Claude Code / CLI patch (NOT Cursor — OOM) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html` (Product Library list render — the page with "Load More", "Import Houzz Products", "Remove Duplicates", trade-cost gold column). Executor greps the "Load More" / 100-limit render to ground exact lines. **Staging first.**

## Execution note (important)
`index.html` is ~5MB. Cursor OOM-crashes on it. Do this edit with **Claude Code or a CLI patch**, not Cursor. Small, targeted change.

## What Cindy said
"I need a way to go to the next page to see all of the lights." The list shows "Showing 100 of 836 products · Load More" and caps at 100. With Lighting filtered, she can't page through all the lights, only Load More one chunk at a time.

## Change
1. **Add real page navigation** to the Product Library list: Prev / Next buttons + a page indicator ("Page 1 of N · 100 per page"), so she can move forward/back without clicking Load More repeatedly. Keep or replace "Load More" (Prev/Next is the ask); a "Show all" option is a fine addition.
2. **CRITICAL — filters must apply to the FULL dataset, then paginate.** Confirm the Vendor / Category (Lighting) / Project filters + search query the **entire 836-product set**, not just the currently-loaded 100. If today the filter only narrows the loaded rows, that's the real bug: she'd never see all lights no matter how she pages. Filter first across all products, then paginate the filtered result.
3. **Show the filtered count + page math:** e.g. "Showing 1-100 of 214 lighting products · Page 1 of 3" so she knows how many lights exist and how many pages remain.
4. **Preserve position (nice-to-have):** returning from Edit/detail shouldn't silently reset to page 1 if avoidable.

## Guardrails
1. List/display change only. **No data or pricing writes.** The trade-cost (DNET) gold-column inline edit must still save exactly as today.
2. Don't change what the list shows per product; just how many pages and how you move between them.
3. Filtering across all 836 must stay responsive (client-side paginate the already-loaded/queried set, or page the query — executor picks; 836 is small, so loading all then client-paginating is fine).
4. Minimal diff; targeted edit, not a rewrite of the Product Library page.

## Acceptance (Fable, staging screenshots)
1. Filter Category = Lighting. The count shows the true total lighting products (all 836 searched, not just first 100), with page navigation.
2. Prev / Next moves through every page of lights; last page shows the final items; no light is unreachable.
3. Trade-cost inline edit still saves ("Trade cost saved").
4. Search + Vendor + Project filters also page correctly across the full set.
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-078 · Product Library real pagination (Prev/Next + full-dataset filtering + page count) · Claude Code exec (index.html OOMs Cursor) · staging first.
