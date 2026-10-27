# Session log — Cursor — 2026-10-03

## Overview

CLO-W-21 did not look like the roller work order template. Page 2 was a text sheet and the shade photo frame was missing.

## What changed

- `platform/builder/index.html` — WO-269. Window work orders stay on one sheet. The photo frame stays in the center. The workroom description is the right column. Builder rev `2026-10-03wo-template`.

## Deployed

Staging hosting, 2026-10-03 ~15:28. Production builder is unchanged.

## Not deployed

- Production hosting. Needs a GO.
- `Functions/index.js`.

## Verify

Hard refresh https://cch-platform-staging.web.app/builder/. Banner should read `2026-10-03wo-template`. Open CLO-W-21. One page, image frame in the center, description on the right.

## WO-270

CLO-W-21 print was too wide because the vendor description sat in the right column. The sheet is 1056px (11 inches) on screen, letter landscape when printed. Staging rev `2026-10-03wo-desc-page2` puts that description on page 2. Production unchanged.

Cindy’s design deck is `Cloud_RH_WT_CCH_Rev2.pptx` (30 slides). WO-271 reads that deck. Staging rev `2026-10-03wo-ppt-design`. 18 budget rooms match a slide. Great Room Dormer does not. Production unchanged.

## WO-272

Estimate 2026-00641 was titled Great Room Dormer. The scope is Stair Tower Windows. Opening that work order renames the room to Stair Tower. Staging rev `2026-10-03wo-stair-tower`. Production unchanged.

## WO-273

Pictures from `Cloud_RH_WT_CCH_Rev2.pptx` are on 19 staging work orders. Script `_scripts/apply-rh-wt-ppt-design_BY_CURSOR_2026-10-03.js --apply` ended APPLIED 19. Prices and vendor descriptions were not written. Master Bedroom CLO-W-14 has the slider (W5.1 & W5.2). Small windows W6 & W7 were not copied. Production unchanged. No hosting deploy.

## Open

- Cloud Code has not written PASS/FAIL for WO-255–258.
- Sort-by-room was not built.
