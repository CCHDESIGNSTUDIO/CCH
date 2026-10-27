# WO-269 DONE — window work order stays on the template

Cindy Oct 3, CLO-W-21 (Roller Shade, Great Room Dormer): the sheet did not look like the work order template. Page 2 was only the description, and the shade photo frame was missing.

## What changed

`platform/builder/index.html`

- Window treatments (roller, drapery, roman, flatfold, style) no longer get a second text page. `updatePreview` (~9801, ~10042, ~10128).
- The center column always draws the photo frame (`.pp-rendering`) even before an image is added.
- The workroom description prints in the right column of that same sheet.
- Builder rev `2026-10-03wo-template`.

No re-upload. Existing work orders pick this up on refresh.

## Not changed

Financial-document print CSS. Prices, proposal lines, QuickBooks. Production.

## Verify

Hard refresh staging Order Builder. Open CLO-W-21. One page. Image frame in the center. Description on the right.
