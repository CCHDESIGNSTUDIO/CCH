# WO-305 DONE — copy keeps every product image

**State:** DONE-UNVERIFIED
**Date:** 2026-10-16
**Studio:** 9.9.390 `copy-all-images` in the working copy. Not deployed.
**Asked by:** Cindy. A copied product in another location was left with one image. Every image has to come with the copy.

## What changed

`platform/index.html`

- `cchEnforcePoLineSingleImage` (~13687) no longer deletes the gallery. It keeps every photo. `imageUrl` stays the hero thumbnail.
- `cchAttachAllProductImages` (~16259) copies photos from this clip and from the same product in other rooms.
- Proposal duplicate (~10706) and Edit duplicate `docEditDuplicateLine` (~41497) use that, and they drop the old one-photo flag.
- Line editor (~37282, ~37321) loads the full set on a proposal, invoice, or PO. A photo replaced by hand (`_imageManual`) stays.
- Picker collapse `_disCollapsePickerClipsByProduct` (~44512) unions photos from every room of that product before it is added again.
- PO image upload (`piUploadImages` ~37792) adds the new photo. It does not wipe the ones already on the line.
- New clip created from a doc line already stores `images` (WO-304, ~14448).

## Surfaces

Proposals, invoices, and purchase orders. This is the line data, not print CSS. Print was not changed.

## Not deployed

Production is still 9.9.387. Staging is still 9.9.388. This file also contains the portal pages (WO-299, WO-302, WO-303). Do not ship production until Cindy's GO covers that.

## Self-test

Read the copy, editor, picker, and PO upload paths after the edit. Did not sign in and click a live project.
