# WO-268 DONE — work order page 1 keeps the image slots

Cindy Oct 2, CLO-W-20 (Roller Shade, Bar): the full-width description left no room for the images and details.

## What changed

`platform/builder/index.html`

- `dbSyncScopePage2` (after `dbSyncFabricationPage2`, ~1336): when the workroom description is longer than 80 characters, it prints on page 2. Page 1 is the normal sheet: short design intent in the left column, Roller Shade Design and detail photos in the center, notes and approval at the bottom.
- `updatePreview` (~9800, ~9858, ~10128): page label is 1 OF 2. The long text is not drawn across the top of page 1.
- Builder rev `2026-10-02wo-scope-page2`.

No re-upload. Existing work orders pick this up on refresh.

## Not changed

Financial-document print CSS. Prices, proposal lines, QuickBooks, Square. Production.

## Verify

Hard refresh staging Order Builder. Open CLO-W-20. Page 1 has the image area. Page 2 has the workroom description.
