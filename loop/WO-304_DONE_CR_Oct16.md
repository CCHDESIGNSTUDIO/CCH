# WO-304 DONE — Copied clip line keeps the product link

**Date:** 2026-10-16
**State:** DONE-UNVERIFIED
**Deploy:** not deployed. Waiting on Cindy's typed GO for production.

## Symptom

Copying a clipped product line, then editing it, did not keep the product link or the clip details that lived on the clip rather than on the line.

## Grounding

- `docEditDuplicateLine` at `platform/index.html` cloned the row and saved it. The product page and library id often live on the clip, not the line.
- `saveDocLineItem` deleted `productUrl`, `pageUrl`, `sourceUrl`, and `clippedFromUrl` when the Product page box was empty.
- The line editor loaded clip photos and clip details only for proposals. Invoices and POs did not.
- A new room-board clip created from a line did not copy the product URL, images, finish, or size.

## Change

`platform/index.html` only. Studio 9.9.389, tag `copy-clip-line`.

- Duplicate (edit grid and proposal row) copies the clip's product link, SKU, finish, size, and description onto the new line before save.
- Edit save writes the Product page when it is filled, and no longer deletes an existing product link when the box is empty. It keeps `libraryProductId` and `clipId`.
- Invoice and PO editors load those clip details. They still do not pull clip photos over a line photo.
- Adding a clip from the sidebar stamps the product URL onto the line.
- A clip created from a document line stores the product URL, images, finish, and size.

## Not changed

Money, markup, paid or approved amounts. Print CSS. QuickBooks.

## Not verified in the browser

I did not sign in and duplicate a live line. Production is still 9.9.387.

## Deploy warning

This working copy also contains the staging portal pages (WO-299, WO-302, WO-303). A production deploy of this file ships those too. Do not deploy until Cindy's GO says that is included, or the portal pages are split out first.
