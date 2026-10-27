# Session log — Cursor — 2026-10-01

## Overview

Vendor bid import treated the paragraph under a price as the next line. PRO-3048 (121 lines) would not open. WO-260 fixes the line rule and raises the open cap to 600.

## What changed

- `platform/cch-vendor-bid-import.js` — one cost, one line; following verbiage is the description.
- `platform/index.html` — proposal open cap 600; build 9.9.371; vendor-bid cache buster.
- WO-259 (send dialog closes) is still in the working copy and will ride on the next hosting deploy. It was not deployed on Sep 30.

## Deployed

Production hosting 2026-10-01. Live build 9.9.371. WO-259 (send dialog closes) shipped in the same hosting.

## Not deployed

- `Functions/index.js` Square/QB confirmation helpers are source-only. Do not deploy functions from the dirty file.

## WO-262

Workroom Description added on the Order Builder (edit + tear sheet). Staging. Production needs a GO.

## WO-263 and WO-264 (staging only, 2026-10-01 ~16:25)

- WO-263 — Order Builder Import Workroom Estimate no longer crashes on a PDF with no Vendor line. Estimates with Description/Qty use the invoice line parser. Builder rev `2026-10-01wo-import-trim`.
- WO-264 — Studio 9.9.373. Proposal Manage/Edit: Create work orders. One draft per item. Lining, installation, labor, and freight skipped. WO number on the Tag. Design intent is the client description. Workroom Description left blank. Prices and approval lock unchanged. Production still 9.9.371 until a GO.

## Open

- PRO-3048 items were not deleted. Re-import adds. Old split lines have to be removed before a clean import.
- Cloud Code has not written PASS/FAIL for WO-255–258.
- Sort-by-room/category was not built.
- Functions/index.js was not deployed.

## Verify

Hard refresh https://cch-platform.web.app. Sidebar should read 9.9.371 after deploy. Import a vendor quote onto a proposal that does not already hold the bad split. Each price is one line. The paragraph is the description.
