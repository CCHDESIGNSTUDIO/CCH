# WO-225 DONE — Tear sheet Hero only: no empty filmstrip

**Change ID:** 9.9.345  
**Date:** 2026-09-13  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 13 Cloud Rolling Hills invoice tear sheets (Hex Lantern, Large Rec Glass Lantern sconce): chose **Hero only**, still got Filmstrip 3A with four empty gray boxes.

## Diagnosis (file:line)

- Modal still offers Hero only (`index.html` ~16885). `readTearSheetOptsFromForm` sets `imageMode: 'hero'` (~16821). `_tearSheetPageHtml` clears extras (~16669).
- Default layout is 3A (`_tearResolveLayoutId` ~16300). `_tearSheetPageHtml3A` (~16316) always built four `.ts-3a-thumb` slots and kept `grid-template-columns: 1fr 300px`. Empty URLs become `#F1F1F0` placeholders (`_tearSheetCoverImg` ~16306).
- Classic gallery already treated one image as full-width (`_tearSheetImageHtml` ~16221). 3A/3B never did.

## Change

3A and 3B omit the side strip when Hero only **or** there are no extra photos. Hero uses full width (`.ts-3a-images--hero` / `.ts-3b-images--hero`). All images with 2+ photos still filmstrips.

## Surfaces

- **Affects:** Generate Tear Sheets window (proposal / invoice / clip).
- **Does not:** Proposal / invoice / PO Print-PDF Bill To / Ship To / line items. RFQ classic unchanged.

## Verify

Hard refresh. Sidebar **9.9.345**. INV-6064 (or any invoice) Generate Tear Sheets → **Hero only** → Hex Lantern: one large photo, no gray column. Same product **All images** with only one photo: also no empty strip. A 5-photo line on 3A still shows the filmstrip.
