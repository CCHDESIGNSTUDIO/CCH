# WO-295 DONE — PO line photo is the line’s own photo

Cindy Oct 12, PO-12915 (Cloud Rolling Hills, Concretti): photos keep coming back wrong, or missing.

## What is on the document

Production `purchaseOrders/po-12915` (read only). Three lines, Manhattan / San Francisco / New York. Every `imageUrl` is `""`. No `updatedAt`. Houzz import dated 11/02/2025. The photos were never saved on the PO.

Linked invoice IN-12902 (`17zvCe3CeU7fZIkkseGW`) has the photos: Manhattan and New York are Studio uploads on the invoice; San Francisco is the Houzz file also on the Powder-room clip.

The PO screen was not using those. `getBestImageUrl` (`platform/index.html` ~15645) fills a blank line from the product library by title. Manhattan matched the Concretti library row. New York matched a library row with no vendor, and that file does not display, so the cube. San Francisco has no library row, so it fell through to a clip. A name like New York is not a safe match.

## Change

PO view, PO edit, and PO print take the photo in this order only:

1. The photo stored on that PO line.
2. The linked invoice line with the same title and room.
3. The project clip with the same title and room.

A library product with the same name is not used. The first Save on the PO copies that photo onto the line and marks it manual, so the next open does not go looking again. A photo already on the line is left alone.

Proposals and invoices still use their own image lookup. No print CSS change.

## Files

- `platform/index.html` — `cchPoStoredLineImageUrl`, `cchPoLineDisplayImageUrl`. `renderPODetail` loads the linked invoice (and clips only if the invoice has no photo). PO edit thumb and `docEditSave` use the same helper. Studio 9.9.383.
- `platform/cch-proposals-invoices-fix.js` — PO view and PO print call `cchPoLineDisplayImageUrl`. Cache `?v=20261012wo295`.

## Self-test

`node --check` on `cch-proposals-invoices-fix.js`, exit 0. Not opened in the browser. Not deployed. Firestore was not written.

## Verify

Hard refresh after GO. PO-12915: Manhattan, San Francisco, and New York show the IN-12902 photos, including New York. Save the PO once. Reload. The three `imageUrl` fields are filled. Changing a library photo named New York does not change this PO.
