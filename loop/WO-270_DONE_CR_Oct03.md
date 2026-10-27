# WO-270 DONE — workroom description on page 2

Cindy Oct 3, CLO-W-21 print. The sheet is 1056px wide (11 inches). The vendor description was in the right column, so the print was too wide and spilled a blank second page.

## What changed

`platform/builder/index.html`

- Long workroom description prints on page 2 (`dbSyncScopePage2`, `updatePreview` ~9801 and ~10135). Page 1 keeps Design Intent, the shade photo frame, notes, and approval.
- Print hides the builder header and buttons so the PDF is the sheet.
- Builder rev `2026-10-03wo-desc-page2`.

## Not changed

Prices, the proposal, or the PowerPoint. Production.

## Verify

Hard refresh. Open CLO-W-21. Page 1 is the landscape sheet. Page 2 is the workroom description.
