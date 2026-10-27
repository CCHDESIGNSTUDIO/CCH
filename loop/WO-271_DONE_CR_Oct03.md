# WO-271 DONE — PowerPoint design onto matching work orders

Cindy Oct 3. The proposal import left empty photo boxes. The designs are in `Cloud_RH_WT_CCH_Rev2.pptx`.

## What changed

`platform/builder/index.html`

- Button **Bring in design from PowerPoint** (`importDesignFromPowerPoint`).
- Matches a slide to a work order by room. Checked against the 19 budget rooms: 18 match. Great Room Dormer has no slide.
- Copies the largest pictures into the shade photo and the detail slots, the W tag when the tag is empty, and the design-specification lines into Notes.
- Does not write `workroomDescription` or `workroomCosts`.
- Builder rev `2026-10-03wo-ppt-design`.

## Verify

Hard refresh staging Order Builder. Open any Cloud Rolling Hills work order. Bring in design from PowerPoint. Choose `Cloud_RH_WT_CCH_Rev2.pptx`. Confirm. Open Bar or Butler Pantry and check the picture, the tag, and the notes. The price and the vendor description should be unchanged.
