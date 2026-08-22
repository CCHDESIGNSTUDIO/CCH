# WO-077-B · Work Order tear sheet — dedicated fabrication page 2 (complex pieces) · CW Aug 04
**Change ID:** pending #1 · **Lane:** Builder · **State:** OPEN · **Executor:** Cursor · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/builder/index.html` → `buildWorkOrderPrint` (~9275) + its print CSS (`@media print` ~493, existing `page-break` rules ~505+). **Staging first; minimal diff; 5MB file, extend the print fn, don't rewrite it.**

## Decision (Cindy, Aug 04)
Chose **"Add page 2, keep current look."** A chair/barstool stays a clean one-page tear sheet. A sofa/sectional (any piece whose fabrication drawing needs to be read at real size) gets a **second page** dedicated to the full-size fabrication drawing + construction details. NOT the full architectural title-block/revisions format (that option was declined). Reference examples: Sofa Sleeper (overview → fabrication → render) and Shimanio Sectional (A-17 overview → A-18 full dimensioned fabrication).

## What Cindy said
"Maybe we need a separate page for the fabrication sheet and details." The current single page shoves the fabrication drawing into a ~2-inch thumbnail; a dimensioned sofa/sectional is unreadable there. The uploaded fabrication drawing (hand-drawn CAD/SketchUp, same asset the current sheet already accepts) needs its own full-width page.

## Change
1. **Toggle, default OFF.** Add a per-WO control, e.g. **"Fabrication on its own page"** (label TBD). Default off = today's exact behavior, so every existing chair/barstool tear sheet (WES-U-01/02/03, CLO-U-01, etc.) is unchanged. Only when ON does page 2 appear. This guarantees no regression to the one-pagers already approved.
2. **Page 1 unchanged.** Keep the current tear sheet exactly as-is in look. (The small FABRICATION DRAWING thumbnail may stay on page 1 as a reference, or that space is freed — Cursor's call, but do not restyle page 1.)
3. **Page 2 = fabrication + details.** New page hosts the uploaded fabrication drawing(s) at **full page width**, plus an optional **construction / details notes** block (the longer build spec, e.g. frame/cushion/leg construction). If more than one fabrication image, they stack and flow to page 3 as needed.
4. **Pagination mechanics.**
   - Real print page breaks (reuse the existing `page-break` / `@media print` infrastructure ~493-764).
   - **Repeat the header on every page:** CCH logo + `WORK ORDER: UPHOLSTERY <id>` + `PROJECT · DATE · REV` + `TAG`, so page 2 is self-identifying like the reference PDFs.
   - **Dynamic page count:** the hardcoded **"1 OF 1"** must become "1 OF 2 / 2 OF 2" (or 1 OF N). Find and parameterize that string in `buildWorkOrderPrint`.

## Guardrails
1. **No regression to one-pagers.** Toggle default off; a WO that doesn't turn it on prints byte-for-byte as it does today.
2. **Keep the current visual language.** No architectural title block, no revisions table (that was the declined option). Same fonts, hairlines, gold accents.
3. Fabrication drawing is an **uploaded asset**, not generated. Page 2 hosts it; the tool does not draw dimensions.
4. Print fits cleanly: page 1 stays one page, page 2 stays one page (drawing scaled to fit width without overflowing to an unwanted page 3 unless there are genuinely multiple drawings).
5. Minimal diff, extend the existing print fn. If it can't be done incrementally, stop and flag (5MB file, crash-prone on big rewrites — same lesson as WO-075-B).

## Acceptance (Fable, staging screenshots)
1. Existing chair/barstool WO with toggle OFF prints identical to today (one page, "1 OF 1").
2. A sofa/sectional WO with toggle ON prints two pages: page 1 = current overview look; page 2 = full-width fabrication drawing + details, with the repeated header and "1 OF 2 / 2 OF 2".
3. Page 2 header identifies the WO (project, id, tag) like the reference PDFs.
4. No page-1 restyle; no stray blank third page.
Screenshots (a one-page piece + a two-page piece) to Fable = sign-off, then Cindy GO for prod.

## Sequencing
Land after WO-075-B (layout) and WO-076-B (finish/nailheads) since those settle page 1; this adds page 2 on top. This is the biggest of the three (structural/pagination), so it's the one to do carefully and last.

## Ledger
Add: WO-077-B · Builder work order — optional dedicated fabrication page 2 for complex pieces (toggle, keep current look, repeat header, dynamic page count) · awaiting Cursor · staging first.
