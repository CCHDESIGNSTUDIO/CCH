# Fable decision — Proposal lines -> Room Boards · CW Jul 24 v1.0
**In response to:** Docs/HANDOFF_FABLE_proposal-to-rooms_CR_Jul24.md (Cursor). **No code shipped; path pick + patch plan only.**

## Decision: D then A. Not B, not C.
Sequence: **D unblocks the boards this week**, **A gives Cindy the clean Selections view** she actually wants. Reject C (schema rewrite, conflicts with the product+room identity already verified/deployed). Reject B as the primary path (reasoning below), keep it as a possible future if A's collapse still feels wrong.

### Why not B (Room Board reads proposal lines directly)
B matches Cindy's sentence best ("just show them on the rooms"), but it fights four things already shipped and locked: document isolation (proposal/invoice/PO lines are snapshots, no library back-sync), the client-portal + print render paths that read clips, the WO-058b unassign/suppression model, and the edit/delete semantics on a board that would now be part-clip, part-doc-overlay. The clip-per-room model (WO-045/055/056/058) is built, verified on staging, and live in prod (v9.8.108). A rides on that investment; B partially discards it and adds isolation risk. Not worth it to save Selections rows that A solves in the display layer.

## The problem, grounded (two stacked, different fixes)
Ann Sacks on RH: Firestore has 3 clips (all vendor "Ann Sacks", source clipper). Savoy is roomed MBR & Bath; both Arcillas have blank room; all three are on PRO-3035 with room MBR & Bath.

1. **Board miss = blank room on the clip.** Room Board render keys off `clip.room` (index.html:22491-22505; clipper is exempt from the hide filter but a blank-room clip still has no board to land on). Fix = WO-045 apply fills the blank room from the roomed doc line. That is D step 2.
2. **Selections hide = source flattened + greedy regex.** Selections maps clips with `source: 'boardclip'` (index.html:17298), so `cchClipShouldHideFromProductViews` (12593) no longer hits its `src==='clipper' -> return false` exemption (12596). Then `cchClipTitleLooksLikeSpecFragment` (12536) fires on the dimension rule at 12549:
   `/\d+(\.\d+)?["proper-quotes]?\s*[x cross]\s*\d+/i && length < 55 && !lightingWords` -> HIDE.
   "Arcilla 3\" x 12\" Field Tile" matches (has a size, under 55, no lighting word). "Savoy Penny Mosaic" has no size -> shown. Same hide also hits the FFE filter (~29405). That is D step 1.

## D step 1 — hide-bug patch (surgical, keep real junk hidden)
Target `cchClipTitleLooksLikeSpecFragment` @ index.html:12549. The rule is meant to catch DIMENSION-ONLY scrap (e.g. "... 7.5 x 7.5"), not a named tile that happens to carry a size. Add a "what's left after removing the dimension" test:

    var stripped = t
      .replace(/\d+(\.\d+)?["proper]?\s*[x cross]\s*\d+(\.\d+)?["proper]?/gi, '')
      .replace(/[.…\s]/g, '');
    if (/\d+(\.\d+)?["proper]?\s*[x cross]\s*\d+/i.test(t) && t.length < 55 &&
        stripped.length < 6 &&                       // <-- almost nothing but the dimension remains
        !/\b(sconce|pendant|...existing list...)\b/i.test(t)) return true;

Effect: "Arcilla 3\" x 12\" Field Tile" -> stripped "ArcillaFieldTile" (16) -> NOT hidden. "... 7.5 x 7.5" -> stripped ~"" -> still hidden. Belt-and-suspenders: also carry the original clip source through the Selections map (add `clipperSource: c.source`) and mirror the Room Board exemption in the Selections filter (17496) so genuine clipper items are never hidden even if the regex ever regresses. Keep the existing junk-phrase lines untouched.

Keep-hidden regression table (must still HIDE): "... 7.5\" x 7.5\"", "weight: 40 lbs", "top to center 18\"", "12 x 12" (bare, no product word). Must now SHOW: Arcilla 3\" x 12\" Field Tile, Arcilla 1\" x 15\" Bullnose Trim, Gleam Ivory 12\"x24\", Savoy Penny Mosaic (already shows).

Assign: WO-060 (hide-bug), Executor Cursor, staging first. Verify on staging Selections + Room Board + FFE, then prod.

## D step 2 — WO-045 prod apply on RH (Cindy GO required)
This is a production data write. Sequence, no surprises:
1. `await window.cchDryRunDocLineClipSync('cloud-rolling-hills')` on PROD. Read totals: wouldFillBlank should include the two Arcillas; wouldCreate = new roomed clips for any roomed doc line with no clip; skippedSuppressed must NOT contain anything Cindy deliberately removed; errors 0.
2. Show Cindy the dry-run numbers + the specific fill/create list for review.
3. On her typed GO only: set apply flag, `cchApplyDocLineClipSync('cloud-rolling-hills')`.
4. Re-dry-run (wouldCreate/fillBlank -> 0), screenshot MBR & Bath (Savoy + both Arcillas) and Guest 5 (Gleam Ivory), confirm WO-058b (unassign still doesn't resurrect).
RH only. No project-wide roll until RH pilot reviewed.

## A (next, after D) — Selections collapse, display only
Collapse the Selections list by `libraryProductId` (fallback title+vendor) into ONE row per product, with **room chips** ("MBR & Bath", "Guest 5", "+2") like the multi-doc badges proposals already show. Underlying clips stay N (boards still work); Cindy sees ~1 row. No data-model change. Sketch only until Cindy says go.

## Out of scope (explicit)
WO-045 durable default-on for new saves (separate follow-on WO); multi-project roll of the apply; proposal numbering; QuickBooks; any Selections data-model rewrite.

## Verify anchors
Library Ann Sacks 3 -> MBR & Bath board shows Savoy + both Arcillas. Guest 5 shows Gleam Ivory 12x24. Selections Ann Sacks filter shows an honest/collapsed count, not "1 of 3 hidden." Unassign still does not resurrect (WO-058b). Build tags noted.
